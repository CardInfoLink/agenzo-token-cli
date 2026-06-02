import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { CredentialStore } from '../config/credential-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';
import { CommandResult } from '../types/commands.js';
import { resolveFormat, render, notify } from '../utils/output.js';
import { ApiBusinessError, IdempotencyKeyRequiredError } from '../utils/errors.js';

export function registerUpdateCommand(
  parent: Command,
  deps: {
    apiClient: ApiClient;
    authService: AuthService;
    credentialStore: CredentialStore;
    configManager: ConfigManager;
  },
): void {
  parent
    .command('update')
    .description('Update current organization')
    .option('--name <name>', 'New organization name')
    .option('--email <email>', 'New email')
    .option('--idempotency-key <key>', 'Idempotency key forwarded as the Idempotency-Key header')
    .action(async (options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      // --idempotency-key is mandatory on every server write; the CLI never
      // auto-generates it. When absent, prompt for it interactively. In
      // non-interactive mode (--yes) prompting would hang, so require the flag.
      let idempotencyKey = options.idempotencyKey as string | undefined;
      if (!idempotencyKey) {
        if (command.optsWithGlobals().yes) {
          throw new IdempotencyKeyRequiredError('orgs update');
        }
        idempotencyKey = await PromptEngine.resolveInput(undefined, {
          message: 'Idempotency key (unique per write, for safe retry):',
          validate: (v) => v.trim().length > 0 || 'Idempotency key is required',
        });
      }
      const extraHeaders: Record<string, string> = {
        'Idempotency-Key': String(idempotencyKey),
      };

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.post<Organization & {
          magic_link_token?: string;
          expires_at?: string;
        }>(
          '/organizations/me/update',
          { type: 'bearer', token },
          body,
          extraHeaders,
        ),
      );

      if (!result.success) {
        throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
      }

      const data = result.data;

      // Email change does NOT update the org inline — the backend returns a
      // magic-link verification payload ({ magic_link_token, expires_at })
      // instead of the Organization. Detect that shape and render it as a
      // pending-verification result rather than an Organization (which would
      // show every field as `undefined`).
      if (data.magic_link_token) {
        notify(
          format,
          'info',
          'Verification email sent to the new address. The email changes once verified.',
        );
        const verifyResult: CommandResult<{
          magic_link_token: string;
          expires_at?: string;
        }> = {
          data: {
            magic_link_token: data.magic_link_token,
            expires_at: data.expires_at,
          },
          text: () =>
            Formatter.keyValue([
              ['Status', 'PENDING_EMAIL_VERIFICATION'],
              ['Magic Link Token', data.magic_link_token ?? ''],
              ['Expires At', Formatter.formatTime(data.expires_at)],
            ]),
        };
        render(verifyResult, { format });
        return;
      }

      const org = data;

      // Sync local credential cache with updated org info.
      const activeOrg = await deps.configManager.getActiveOrg();
      if (activeOrg) {
        const cred = await deps.credentialStore.get(activeOrg);
        if (cred && options.name) {
          cred.org_name = org.name;
          await deps.credentialStore.save(cred);
        }
      }

      // Status / hint lines are logs — stderr, and only in table mode
      // (json mode stays silent for agent consumers).
      notify(format, 'success', 'Organization updated');

      const commandResult: CommandResult<Organization> = {
        data: org,
        text: () =>
          Formatter.keyValue([
            ['Org ID', org.id],
            ['Name', org.name],
            ['Email', org.email],
            ['Status', org.status],
          ]),
      };

      render(commandResult, { format });
    });
}
