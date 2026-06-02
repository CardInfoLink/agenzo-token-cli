import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { render, resolveFormat } from '../utils/output.js';
import { ApiBusinessError } from '../utils/errors.js';
import { CommandResult } from '../types/commands.js';
import { Developer } from '../types/api.js';

export function registerListCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('list')
    .description('List all developers')
    .action(async (_options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.get<Developer[]>(
          '/developers',
          { type: 'bearer', token },
        ),
      );

      if (!result.success) {
        throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
      }

      const developers = result.data;
      const commandResult: CommandResult<Developer[]> = {
        data: developers,
        text: () => {
          if (developers.length === 0) {
            return Formatter.status('info', 'No developers found');
          }
          const headers = ['ID', 'Name', 'Email', 'Status'];
          const rows = developers.map((d) => [d.id, d.name, d.email, d.status]);
          return Formatter.table(headers, rows);
        },
      };

      render(commandResult, { format });
    });
}
