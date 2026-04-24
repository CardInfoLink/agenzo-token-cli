import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { ApiKey } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('list')
    .description('List API Keys')
    .option('--developer-id <developer_id>', 'Developer ID (e.g. dev_01KPX...)')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const developerId = await PromptEngine.resolveInput(options.developerId, {
        message: 'Developer ID (e.g. dev_01KPX...):',
      });

      const result = await deps.apiClient.get<ApiKey[]>(
        '/keys',
        { type: 'bearer', token },
        { developer_id: developerId },
      );

      if (result.success) {
        if (result.data.length === 0) {
          console.log(Formatter.status('info', 'No API Keys found'));
          return;
        }
        const headers = ['ID', 'Developer', 'Name', 'Status', 'Last Used'];
        const rows = result.data.map((k) => [
          k.id,
          k.developer_id,
          k.name,
          k.status,
          k.last_used_at ?? 'Never',
        ]);
        console.log(Formatter.table(headers, rows));
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
