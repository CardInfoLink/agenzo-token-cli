import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { render, resolveFormat } from '../utils/output.js';
import { ApiBusinessError } from '../utils/errors.js';
import { CommandResult } from '../types/commands.js';
import { Developer } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get <developer_id>')
    .description('View developer details')
    .action(async (developerId: string, _options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.get<Developer>(
          `/developers/${developerId}`,
          { type: 'bearer', token },
        ),
      );

      if (!result.success) {
        throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
      }

      const dev = result.data;
      const commandResult: CommandResult<Developer> = {
        data: dev,
        text: () =>
          Formatter.keyValue([
            ['ID', dev.id],
            ['Name', dev.name],
            ['Email', dev.email],
            ['Status', dev.status],
            ['Billing Mode', dev.billing_mode ?? '-'],
            ['Created', Formatter.formatTime(dev.created_at)],
            ['Updated', Formatter.formatTime(dev.updated_at)],
          ]),
      };

      render(commandResult, { format });
    });
}
