import { ApiClient, ApiResult, AuthMode } from '../api/client.js';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { OrgCredential } from '../types/config.js';
import {
  MagicLinkStatusResponse,
  RefreshResponse,
} from '../types/api.js';
import { AuthError } from '../utils/errors.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { createSpinner, Spinner } from '../utils/formatter.js';

export interface LoginResult {
  credential: OrgCredential;
  isNewRegistration: boolean;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_REFRESH_THRESHOLD_S = 300; // 5 minutes

export class AuthService {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly credentialStore: CredentialStore,
    private readonly configManager: ConfigManager,
  ) {}

  async login(email: string): Promise<LoginResult> {
    let isNewRegistration = false;
    const noAuth: AuthMode = { type: 'none' };

    // Step 1: Try login
    const loginResult = await this.apiClient.post<{ magic_link_token: string }>(
      '/auth/login',
      noAuth,
      { email },
    );

    let magicLinkToken: string;

    if (!loginResult.success && loginResult.errorCode === 1007) {
      // Email not registered — collect org name and register
      isNewRegistration = true;
      const orgName = await PromptEngine.resolveInput(undefined, {
        message: 'Organization name:',
      });
      const registerResult = await this.apiClient.post<{ magic_link_token: string }>(
        '/auth/register',
        noAuth,
        { email, organization_name: orgName },
      );
      if (!registerResult.success) {
        throw new AuthError(
          `Registration failed: ${registerResult.errorMessage}`,
          'Please check your input and try again',
        );
      }
      magicLinkToken = registerResult.data.magic_link_token;
    } else if (!loginResult.success) {
      throw new AuthError(
        `Login failed: ${loginResult.errorMessage}`,
        'Please check your email and try again',
      );
    } else {
      magicLinkToken = loginResult.data.magic_link_token;
    }

    // Step 2: Poll magic link status
    const credential = await this.pollMagicLinkStatus(magicLinkToken, email);

    // Step 3: Save credential and update active org
    await this.credentialStore.save(credential);
    await this.configManager.setActiveOrg(credential.org_id);

    return { credential, isNewRegistration };
  }

  private async pollMagicLinkStatus(
    magicLinkToken: string,
    email: string,
  ): Promise<OrgCredential> {
    const startTime = Date.now();
    const noAuth: AuthMode = { type: 'none' };
    const spinner = createSpinner('Waiting for email verification');

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      const result = await this.apiClient.get<MagicLinkStatusResponse>(
        '/auth/magic-links/status',
        noAuth,
        { token: magicLinkToken },
      );

      if (!result.success) {
        spinner.stop();
        if (result.errorCode === 1101) {
          throw new AuthError('Magic link expired', 'Please run agenzo-token-cli login again');
        }
        throw new AuthError(
          `Polling failed: [${result.errorCode}] ${result.errorMessage}`,
          'Please run agenzo-token-cli login again',
        );
      }

      const data = result.data;

      if (data.status === 'CONSUMED') {
        spinner.stop();
        const raw = data as unknown as Record<string, unknown>;
        const org = raw.organization as Record<string, unknown> | undefined;

        const orgId = String(raw.organization_id ?? org?.id ?? '');
        const orgName = String(org?.name ?? '');

        // Handle expires_at: could be ISO string or unix timestamp
        let accessExpiresAt: number;
        const rawExpires = raw.expires_at ?? data.access_token_expires_at;
        if (typeof rawExpires === 'string') {
          accessExpiresAt = Math.floor(new Date(rawExpires).getTime() / 1000);
        } else {
          accessExpiresAt = (rawExpires as number) ?? 0;
        }

        const refreshExpiresAt = data.refresh_token_expires_at
          ?? accessExpiresAt + 30 * 24 * 60 * 60;

        return {
          org_id: orgId,
          org_name: orgName,
          email,
          access_token: data.access_token!,
          refresh_token: data.refresh_token!,
          access_token_expires_at: accessExpiresAt,
          refresh_token_expires_at: refreshExpiresAt,
        };
      }

      if (data.status === 'EXPIRED') {
        spinner.stop();
        throw new AuthError('Magic link expired', 'Please run agenzo-token-cli login again');
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    spinner.stop();
    throw new AuthError('Login timed out (10 minutes)', 'Please run agenzo-token-cli login again');
  }

  async logout(): Promise<void> {
    const orgId = await this.configManager.getActiveOrg();
    if (!orgId) {
      throw new AuthError('Not signed in', 'Please run agenzo-token-cli login first');
    }

    const credential = await this.credentialStore.get(orgId);
    if (credential) {
      // Best-effort server logout
      try {
        await this.apiClient.post(
          '/auth/logout',
          { type: 'bearer', token: credential.access_token },
        );
      } catch {
        // Ignore network errors during logout
      }
    }

    await this.credentialStore.delete(orgId);
  }

  async getValidAccessToken(): Promise<string> {
    const orgId = await this.configManager.getActiveOrg();
    if (!orgId) {
      throw new AuthError('Not signed in', 'Please run agenzo-token-cli login first');
    }

    const credential = await this.credentialStore.get(orgId);
    if (!credential) {
      throw new AuthError('Not signed in', 'Please run agenzo-token-cli login first');
    }

    const now = Math.floor(Date.now() / 1000);
    if (credential.access_token_expires_at - now < TOKEN_REFRESH_THRESHOLD_S) {
      try {
        await this.refreshToken(orgId);
        const refreshed = await this.credentialStore.get(orgId);
        return refreshed!.access_token;
      } catch {
        // Refresh failed (token expired, revoked, etc.) — auto re-login
        return this.autoReLogin(credential);
      }
    }

    return credential.access_token;
  }

  /**
   * Automatically re-login using the stored email.
   * Sends a magic link and polls until verified, then updates the
   * credential without changing the active org.
   */
  private async autoReLogin(credential: OrgCredential): Promise<string> {
    const { Formatter } = await import('../utils/formatter.js');
    console.log(Formatter.status('info', 'Session expired, re-authenticating'));
    console.log(Formatter.status('loading', 'Sending magic link'));

    const noAuth: AuthMode = { type: 'none' };
    const loginResult = await this.apiClient.post<{ magic_link_token: string }>(
      '/auth/login',
      noAuth,
      { email: credential.email },
    );

    if (!loginResult.success) {
      throw new AuthError(
        `Auto re-login failed: ${loginResult.errorMessage}`,
        'Please run agenzo-token-cli login manually',
      );
    }

    const newCredential = await this.pollMagicLinkStatus(
      loginResult.data.magic_link_token,
      credential.email,
    );

    // Check if re-login returned a different org than expected
    const activeOrg = await this.configManager.getActiveOrg();
    if (activeOrg && newCredential.org_id !== activeOrg) {
      // Save the credential for the org we actually logged into
      await this.credentialStore.save(newCredential);
      // Switch active org to match
      await this.configManager.setActiveOrg(newCredential.org_id);
      console.log(Formatter.status('warning', `You were signed into a different organization: ${newCredential.org_name}. Your active organization has been updated.`));
      throw new AuthError(
        'Please run your command again.',
        'The active organization was switched during re-authentication.',
      );
    }

    // Same org — update credential and continue
    await this.credentialStore.save(newCredential);
    console.log(Formatter.status('success', 'Re-authenticated successfully'));

    return newCredential.access_token;
  }

  async refreshToken(orgId: string): Promise<void> {
    const credential = await this.credentialStore.get(orgId);
    if (!credential) {
      throw new AuthError('Not signed in', 'Please run agenzo-token-cli login first');
    }

    const result = await this.apiClient.post<RefreshResponse>(
      '/auth/refresh',
      { type: 'bearer', token: credential.access_token },
      { refresh_token: credential.refresh_token },
    );

    if (!result.success) {
      if (result.errorCode === 1002) {
        throw new AuthError('Session expired', 'Please run agenzo-token-cli login again');
      }
      throw new AuthError(
        `Token refresh failed: [${result.errorCode}] ${result.errorMessage}`,
        'Please run agenzo-token-cli login again',
      );
    }

    credential.access_token = result.data.access_token;
    credential.refresh_token = result.data.refresh_token;

    // Handle expires_at: backend returns ISO string, we need unix timestamp
    if (result.data.access_token_expires_at) {
      credential.access_token_expires_at = result.data.access_token_expires_at;
    } else if (result.data.expires_at) {
      credential.access_token_expires_at = Math.floor(new Date(result.data.expires_at).getTime() / 1000);
    }

    await this.credentialStore.save(credential);
  }

  /**
   * Execute an authenticated API call with automatic token recovery.
   * If the call returns 1002 (token invalid), attempts refresh → re-login → retry once.
   */
  async executeWithAuth<T>(
    apiFn: (token: string) => Promise<ApiResult<T>>,
  ): Promise<ApiResult<T>> {
    const token = await this.getValidAccessToken();
    const result = await apiFn(token);

    if (!result.success && result.errorCode === 1002) {
      // Token rejected server-side — attempt recovery
      const freshToken = await this.recoverToken();
      return apiFn(freshToken);
    }

    return result;
  }

  /**
   * Attempt token refresh; if that fails, fall back to auto re-login.
   */
  private async recoverToken(): Promise<string> {
    const orgId = await this.configManager.getActiveOrg();
    if (!orgId) {
      throw new AuthError('Not signed in', 'Please run agenzo-token-cli login first');
    }

    const credential = await this.credentialStore.get(orgId);
    if (!credential) {
      throw new AuthError('Not signed in', 'Please run agenzo-token-cli login first');
    }

    try {
      await this.refreshToken(orgId);
      const refreshed = await this.credentialStore.get(orgId);
      return refreshed!.access_token;
    } catch {
      return this.autoReLogin(credential);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
