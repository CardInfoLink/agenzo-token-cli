import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { render, resolveFormat } from '../utils/output.js';
import { ApiBusinessError } from '../utils/errors.js';
import { ApiKey } from '../types/api.js';
import type { CommandResult } from '../types/commands.js';

/** Strip the one-time plaintext key so read commands never expose a secret. */
function toMetadata(key: ApiKey): ApiKey {
  const { api_key: _api_key, ...metadata } = key;
  return metadata;
}

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  const cmd = parent.command('get <key_id>').description('View API Key details');

  cmd.action(async (keyId: string) => {
    const opts = cmd.optsWithGlobals();
    const format = resolveFormat(opts.format as string | undefined);

    const result = await deps.authService.executeWithAuth((token) =>
      deps.apiClient.get<ApiKey>(
        `/keys/${keyId}`,
        { type: 'bearer', token },
      ),
    );

    if (!result.success) {
      throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
    }

    // Metadata only — never expose the plaintext key on a read command.
    const k = toMetadata(result.data);

    const cmdResult: CommandResult<ApiKey> = {
      data: k,
      text: () =>
        Formatter.keyValue([
          ['Key ID', k.id],
          ['Developer ID', k.developer_id],
          ['Name', k.name],
          ['Scope', (k.scope ?? []).join(', ')],
          ['Status', k.status],
          ['Last Used', k.last_used_at ? Formatter.formatTime(k.last_used_at) : 'Never'],
          ['Created', Formatter.formatTime(k.created_at)],
        ]),
    };
    render(cmdResult, { format });
  });
}
