import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get <developer_id>')
    .description('View developer details')
    .action(async (developerId: string) => {
      const token = await deps.authService.getValidAccessToken();

      const result = await deps.apiClient.get<Developer>(
        `/developers/${developerId}`,
        { type: 'bearer', token },
      );

      if (result.success) {
        console.log(
          Formatter.keyValue([
            ['ID', result.data.id],
            ['Name', result.data.name],
            ['Email', result.data.email],
            ['Status', result.data.status],
            ['Created', result.data.created_at],
            ['Updated', result.data.updated_at],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
