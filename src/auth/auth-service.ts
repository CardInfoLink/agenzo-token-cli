import { ApiClient, AuthMode } from '../api/client.js';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { OrgCredential } from '../types/config.js';
import {
  MagicLinkStatusResponse,
  RefreshResponse,
} from '../types/api.js';
import { AuthError } from '../utils/errors.js';
import { PromptEngine } from '../utils/prompt-engine.js';

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
        message: '组织名称:',
      });
      const registerResult = await this.apiClient.post<{ magic_link_token: string }>(
        '/auth/register',
        noAuth,
        { email, organization_name: orgName },
      );
      if (!registerResult.success) {
        throw new AuthError(
          `注册失败: [${registerResult.errorCode}] ${registerResult.errorMessage}`,
          '请检查输入后重试',
        );
      }
      magicLinkToken = registerResult.data.magic_link_token;
    } else if (!loginResult.success) {
      throw new AuthError(
        `登录失败: [${loginResult.errorCode}] ${loginResult.errorMessage}`,
        '请检查邮箱后重试',
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

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      const result = await this.apiClient.get<MagicLinkStatusResponse>(
        '/auth/magic-links/status',
        noAuth,
        { token: magicLinkToken },
      );

      if (!result.success) {
        if (result.errorCode === 1101) {
          throw new AuthError('Magic link 已过期', '请重新执行 agent-token-admin login');
        }
        throw new AuthError(
          `轮询失败: [${result.errorCode}] ${result.errorMessage}`,
          '请重新执行 agent-token-admin login',
        );
      }

      const data = result.data;

      if (data.status === 'CONSUMED') {
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
        throw new AuthError('Magic link 已过期', '请重新执行 agent-token-admin login');
      }

      // PENDING — wait and retry
      await this.sleep(POLL_INTERVAL_MS);
    }

    throw new AuthError('登录超时（10 分钟）', '请重新执行 agent-token-admin login');
  }

  async logout(): Promise<void> {
    const orgId = await this.configManager.getActiveOrg();
    if (!orgId) {
      throw new AuthError('未登录', '请先执行 agent-token-admin login');
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
      throw new AuthError('未登录', '请先执行 agent-token-admin login');
    }

    const credential = await this.credentialStore.get(orgId);
    if (!credential) {
      throw new AuthError('未登录', '请先执行 agent-token-admin login');
    }

    const now = Math.floor(Date.now() / 1000);
    if (credential.access_token_expires_at - now < TOKEN_REFRESH_THRESHOLD_S) {
      await this.refreshToken(orgId);
      const refreshed = await this.credentialStore.get(orgId);
      return refreshed!.access_token;
    }

    return credential.access_token;
  }

  async refreshToken(orgId: string): Promise<void> {
    const credential = await this.credentialStore.get(orgId);
    if (!credential) {
      throw new AuthError('未登录', '请先执行 agent-token-admin login');
    }

    const result = await this.apiClient.post<RefreshResponse>(
      '/auth/refresh',
      { type: 'none' },
      { refresh_token: credential.refresh_token },
    );

    if (!result.success) {
      if (result.errorCode === 1002) {
        throw new AuthError('登录已过期', '请重新执行 agent-token-admin login');
      }
      throw new AuthError(
        `令牌刷新失败: [${result.errorCode}] ${result.errorMessage}`,
        '请重新执行 agent-token-admin login',
      );
    }

    credential.access_token = result.data.access_token;
    credential.access_token_expires_at = result.data.access_token_expires_at;
    await this.credentialStore.save(credential);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
