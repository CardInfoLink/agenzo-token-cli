import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { KeyStore } from '../config/key-store.js';
import { ConfigManager } from '../config/config-manager.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { render, resolveFormat, notify } from '../utils/output.js';
import { ApiBusinessError, IdempotencyKeyRequiredError } from '../utils/errors.js';
import { ApiKey } from '../types/api.js';
import type { CommandResult } from '../types/commands.js';

export function registerRotateCommand(
  parent: Command,
  deps: {
    apiClient: ApiClient;
    authService: AuthService;
    keyStore: KeyStore;
    configManager: ConfigManager;
  },
): void {
  const cmd = parent
    .command('rotate <key_id>')
    .description('Rotate API Key')
    .option(
      '--idempotency-key <key>',
      'Idempotency key forwarded verbatim as the Idempotency-Key header',
    );

  cmd.action(async (keyId: string) => {
    const opts = cmd.optsWithGlobals();
    const format = resolveFormat(opts.format as string | undefined);

    // --idempotency-key is mandatory on every server write; the CLI never
    // auto-generates it. When absent, prompt for it interactively. In
    // non-interactive mode (--yes) prompting would hang, so require the flag.
    let idempotencyKey = opts.idempotencyKey as string | undefined;
    if (!idempotencyKey) {
      if (opts.yes) {
        throw new IdempotencyKeyRequiredError('keys rotate');
      }
      idempotencyKey = await PromptEngine.resolveInput(undefined, {
        message: 'Idempotency key (unique per write, for safe retry):',
        validate: (v) => v.trim().length > 0 || 'Idempotency key is required',
      });
    }
    const extraHeaders: Record<string, string> = {
      'Idempotency-Key': idempotencyKey,
    };

    const result = await deps.authService.executeWithAuth((token) =>
      deps.apiClient.post<ApiKey>(
        `/keys/${keyId}/rotate`,
        { type: 'bearer', token },
        undefined,
        extraHeaders,
      ),
    );

    if (!result.success) {
      throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
    }

    const key = result.data;

    // Update the stored plaintext key (written only on create/rotate).
    const orgId = await deps.configManager.getActiveOrg();
    if (orgId && key.api_key) {
      await deps.keyStore.update(orgId, keyId, key.api_key);
    }

    // Status + one-time-secret warning are logs → stderr (never stdout), and
    // only in table mode. In json mode everything here is silent: the new key
    // is already part of the stdout payload for agent consumers.
    notify(format, 'success', 'API Key rotated');
    if (format === 'table') {
      console.error(Formatter.status('warning', `New API Key: ${key.api_key}`));
      console.error(
        Formatter.status('warning', 'Save it now — this key is shown only once'),
      );
    }

    const cmdResult: CommandResult<ApiKey> = {
      data: key,
      text: () =>
        Formatter.keyValue([
          ['Key ID', key.id],
          ['Name', key.name],
          ['Scope', (key.scope ?? []).join(', ')],
          ['Status', key.status],
        ]),
    };
    render(cmdResult, { format });
  });
}
