import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { ApiKey } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get <key_id>')
    .description('View API Key details')
    .action(async (keyId: string) => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.get<ApiKey>(
        `/keys/${keyId}`,
        { type: 'bearer', token },
      );

      if (result.success) {
        const k = result.data;
        console.log(
          Formatter.keyValue([
            ['Key ID', k.id],
            ['Developer ID', k.developer_id],
            ['Name', k.name],
            ['Prefix', k.key_prefix],
            ['Status', k.status],
            ['Last Used', k.last_used_at ?? 'Never'],
            ['Created', k.created_at],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
