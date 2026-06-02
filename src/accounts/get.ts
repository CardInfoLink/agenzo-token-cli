import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { render, resolveFormat, notify } from '../utils/output.js';
import { ApiBusinessError } from '../utils/errors.js';
import { CommandResult } from '../types/commands.js';
import { SettlementAccount } from '../types/api.js';

export function registerGetCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get')
    .description("Query a developer's settlement account")
    .option('--developer-id <id>', 'Developer ID to query')
    .action(async (options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const developerId = await PromptEngine.resolveInput(options.developerId, {
        message: 'Developer ID (e.g. dev_01HZ...):',
      });

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.get<SettlementAccount | null>(
          '/accounts',
          { type: 'bearer', token },
          { developer_id: developerId },
        ),
      );

      if (!result.success) {
        throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
      }

      const account = result.data;

      // Auto-provisioning means an absent account only happens for legacy
      // developers. The backend returns data:null with a message; render an
      // info line in table mode and emit null in json mode.
      if (!account) {
        notify(
          format,
          'info',
          'No settlement account found for this developer. Complete offline contract signing first.',
        );
        render({ data: null, text: () => '' }, { format });
        return;
      }

      const commandResult: CommandResult<SettlementAccount> = {
        data: account,
        text: () =>
          Formatter.keyValue([
            ['Account ID', account.id],
            ['Developer ID', account.developer_id],
            ['Balance', String(account.balance)],
            ['Currency', account.currency],
            ['Status', account.status],
            ['Created', Formatter.formatTime(account.created_at)],
            ['Updated', Formatter.formatTime(account.updated_at)],
          ]),
      };

      render(commandResult, { format });
    });
}
