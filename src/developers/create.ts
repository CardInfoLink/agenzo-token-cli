import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { Developer } from '../types/api.js';

export function registerCreateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('create')
    .description('Create a developer')
    .option('--dev-name <name>', 'Developer name')
    .option('--dev-email <email>', 'Developer email')
    .action(async (options) => {
      const token = await deps.authService.getValidAccessToken();

      const name = await PromptEngine.resolveInput(options.devName, {
        message: 'Developer name:',
      });
      const email = await PromptEngine.resolveInput(options.devEmail, {
        message: 'Developer email:',
      });

      const result = await deps.apiClient.post<Developer>(
        '/developers/create',
        { type: 'bearer', token },
        { name, email },
      );

      if (result.success) {
        console.log(Formatter.status('success', 'Developer created'));
        const data = result.data as Record<string, unknown>;
        console.log(
          Formatter.keyValue([
            ['ID', String(data.id ?? data.developer_id ?? '-')],
            ['Org ID', String(data.organization_id ?? '-')],
            ['Name', String(data.name ?? '-')],
            ['Email', String(data.email ?? '-')],
            ['Status', String(data.status ?? '-')],
          ]),
        );
      } else {
        console.error(
          Formatter.status('error', `[${result.errorCode}] ${result.errorMessage}`),
        );
      }
    });
}
