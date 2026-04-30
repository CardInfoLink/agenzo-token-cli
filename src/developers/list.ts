import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('list')
    .description('List all developers')
    .action(async () => {
      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.get<Developer[]>(
          '/developers',
          { type: 'bearer', token },
        ),
      );

      if (result.success) {
        if (result.data.length === 0) {
          console.log(Formatter.status('info', 'No developers found'));
          return;
        }
        const headers = ['ID', 'Name', 'Email', 'Status'];
        const rows = result.data.map((d) => [
          d.id,
          d.name,
          d.email,
          d.status,
        ]);
        console.log(Formatter.table(headers, rows));
      } else {
        console.error(
          Formatter.status('error', result.errorMessage),
        );
      }
    });
}
