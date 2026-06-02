import { Command } from 'commander';
import { AuthService } from './auth-service.js';
import { Formatter } from '../utils/formatter.js';
import { resolveFormat, render, notify } from '../utils/output.js';
import type { CommandResult } from '../types/commands.js';

/** Machine payload for `auth logout` (`--format json`). Local-only operation. */
interface LogoutData {
  signed_out: true;
}

export function registerLogoutCommand(
  program: Command,
  deps: { authService: AuthService },
): void {
  program
    .command('logout')
    .description('Sign out of current organization')
    .action(async (_options, command) => {
      // Global `--format` is added by the top-level wiring (task 7.1); until
      // then this falls back to AGENZO_FORMAT / the `table` default.
      const format = resolveFormat(command.optsWithGlobals().format);

      // Throws AuthError when not signed in — the top-level handler owns the
      // exit code and error envelope (Requirement 5.3).
      await deps.authService.logout();

      // Status line is a log, not payload — stderr only, table mode only
      // (json mode stays silent for agent consumers).
      notify(format, 'success', 'Signed out');

      const data: LogoutData = { signed_out: true };
      const commandResult: CommandResult<LogoutData> = {
        data,
        text: () => Formatter.status('success', 'Signed out'),
        note: 'Signed out',
      };

      render(commandResult, { format });
    });
}
