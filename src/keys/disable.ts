import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { DisableResult } from '../types/api.js';

export function registerDisableCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('disable <key_id>')
    .description('Disable API Key')
    .action(async (keyId: string) => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.post<DisableResult>(
        `/keys/${keyId}/disable`,
        { type: 'bearer', token },
      );

      if (result.success) {
        console.log(Formatter.status('success', `API Key ${keyId} disabled`));
        console.log(
          Formatter.keyValue([
            ['Status', result.data.status],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
