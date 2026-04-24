import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerUpdateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('update <developer_id>')
    .description('Update developer info')
    .option('--name <name>', 'New name')
    .option('--email <email>', 'New email')
    .action(async (developerId: string, options) => {
      const token = await deps.authService.getValidAccessToken();

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      const result = await deps.apiClient.post<Developer>(
        `/developers/${developerId}/update`,
        { type: 'bearer', token },
        body,
      );

      if (result.success) {
        console.log(Formatter.status('success', 'Developer updated'));
        console.log(
          Formatter.keyValue([
            ['ID', result.data.id],
            ['Name', result.data.name],
            ['Email', result.data.email],
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
