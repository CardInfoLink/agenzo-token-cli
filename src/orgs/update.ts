import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';

export function registerUpdateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('update')
    .description('Update current organization')
    .option('--name <name>', 'New organization name')
    .option('--email <email>', 'New email')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      const result = await deps.apiClient.post<Organization>(
        '/organizations/me/update',
        { type: 'bearer', token },
        body,
      );

      if (result.success) {
        console.log(Formatter.status('success', 'Organization updated'));
        console.log(
          Formatter.keyValue([
            ['Org ID', result.data.id],
            ['Name', result.data.name],
            ['Email', result.data.email],
            ['Status', result.data.status],
          ]),
        );
        if (options.email) {
          console.log(
            Formatter.status('info', 'Email change requires verification at the new address'),
          );
        }
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
