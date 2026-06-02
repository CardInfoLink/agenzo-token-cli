import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { Organization } from '../types/api.js';
import { CommandResult } from '../types/commands.js';
import { resolveFormat, render } from '../utils/output.js';
import { ApiBusinessError } from '../utils/errors.js';

export function registerMeCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('get')
    .description('View current organization')
    .action(async (_options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.get<Organization>(
          '/organizations/me',
          { type: 'bearer', token },
        ),
      );

      if (!result.success) {
        // Throw so the top-level handler owns the error envelope + exit code.
        throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
      }

      const org = result.data;
      const commandResult: CommandResult<Organization> = {
        data: org,
        text: () =>
          Formatter.keyValue([
            ['Org ID', org.id],
            ['Name', org.name],
            ['Email', org.email],
            ['Status', org.status],
            ['Created', Formatter.formatTime(org.created_at)],
            ['Updated', Formatter.formatTime(org.updated_at)],
          ]),
      };

      render(commandResult, { format });
    });
}
