import { Command } from 'commander';
import { AuthService } from './auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { resolveFormat, render, notify } from '../utils/output.js';
import { IdempotencyKeyRequiredError } from '../utils/errors.js';
import type { CommandResult } from '../types/commands.js';

/**
 * Machine payload for `auth login` (`--format json`).
 *
 * Tokens are deliberately excluded — Bearer `access_token` / `refresh_token`
 * never reach stdout in any format (Requirement 6.1).
 */
interface LoginData {
  org_id: string;
  org_name: string;
  email: string;
  is_new_registration: boolean;
}

export function registerLoginCommand(
  program: Command,
  deps: { authService: AuthService },
): void {
  program
    .command('login')
    .description('Sign in to Agent Payment API')
    .option('--email <email>', 'Email address')
    .option(
      '--idempotency-key <key>',
      'Forwarded verbatim as the Idempotency-Key header on login/registration',
    )
    .action(async (options, command) => {
      // Global `--format` is added by the top-level wiring (task 7.1); until
      // then this falls back to AGENZO_FORMAT / the `table` default.
      const format = resolveFormat(command.optsWithGlobals().format);

      const email = await PromptEngine.resolveInput(options.email, {
        message: 'Email:',
      });

      // --idempotency-key is mandatory on every server write; the CLI never
      // auto-generates it. When absent, prompt for it interactively. In
      // non-interactive mode (--yes) prompting would hang, so require the flag.
      let idempotencyKey = options.idempotencyKey as string | undefined;
      if (!idempotencyKey) {
        if (command.optsWithGlobals().yes) {
          throw new IdempotencyKeyRequiredError('auth login');
        }
        idempotencyKey = await PromptEngine.resolveInput(undefined, {
          message: 'Idempotency key (unique per write, for safe retry):',
          validate: (v) => v.trim().length > 0 || 'Idempotency key is required',
        });
      }

      // Forward `--idempotency-key` verbatim; never auto-generate (Requirement 4.3).
      // quiet in json mode so agent consumers get clean output.
      const result = await deps.authService.login(email, {
        idempotencyKey,
        quiet: format === 'json',
      });

      // Status/progress lines are logs, not payload — stderr only, and only in
      // table mode (json mode stays silent for agent consumers).
      const signedInMessage = result.isNewRegistration
        ? 'Registered and signed in'
        : 'Signed in successfully';
      notify(format, 'success', signedInMessage);

      const data: LoginData = {
        org_id: result.credential.org_id,
        org_name: result.credential.org_name,
        email: result.credential.email,
        is_new_registration: result.isNewRegistration,
      };

      const commandResult: CommandResult<LoginData> = {
        data,
        text: () =>
          Formatter.keyValue([
            ['Org ID', data.org_id],
            ['Org Name', data.org_name],
            ['Email', data.email],
          ]),
        note: signedInMessage,
      };

      render(commandResult, { format });
    });
}
