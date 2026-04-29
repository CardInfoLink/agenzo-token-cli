import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';

export function registerMeCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('me')
    .description('View current organization')
    .action(async () => {
      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.get<Organization>(
          '/organizations/me',
          { type: 'bearer', token },
        ),
      );

      if (result.success) {
        console.log(
          Formatter.keyValue([
            ['Org ID', result.data.id],
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
