import { Command } from 'commander';
import { ApiClient } from '../api/client.js';
import { AuthService } from '../auth/auth-service.js';
import { PromptEngine } from '../utils/prompt-engine.js';
import { Formatter } from '../utils/formatter.js';
import { render, resolveFormat, notify } from '../utils/output.js';
import { ApiBusinessError, IdempotencyKeyRequiredError } from '../utils/errors.js';
import { CommandResult } from '../types/commands.js';
import { Developer } from '../types/api.js';

export function registerUpdateCommand(
  parent: Command,
  deps: { apiClient: ApiClient; authService: AuthService },
): void {
  parent
    .command('update <developer_id>')
    .description('Update developer info')
    .option('--name <name>', 'New name')
    .option('--email <email>', 'New email')
    .option('--idempotency-key <key>', 'Idempotency key forwarded as the Idempotency-Key header')
    .action(async (developerId: string, options, command: Command) => {
      const format = resolveFormat(command.optsWithGlobals().format);

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.email) body.email = options.email;

      // --idempotency-key is mandatory on every server write; the CLI never
      // auto-generates it. When absent, prompt for it interactively. In
      // non-interactive mode (--yes) prompting would hang, so require the flag.
      let idempotencyKey = options.idempotencyKey as string | undefined;
      if (!idempotencyKey) {
        if (command.optsWithGlobals().yes) {
          throw new IdempotencyKeyRequiredError('developers update');
        }
        idempotencyKey = await PromptEngine.resolveInput(undefined, {
          message: 'Idempotency key (unique per write, for safe retry):',
          validate: (v) => v.trim().length > 0 || 'Idempotency key is required',
        });
      }
      const extraHeaders: Record<string, string> = {
        'Idempotency-Key': String(idempotencyKey),
      };

      const result = await deps.authService.executeWithAuth((token) =>
        deps.apiClient.post<Developer>(
          `/developers/${developerId}/update`,
          { type: 'bearer', token },
          body,
          extraHeaders,
        ),
      );

      if (!result.success) {
        throw new ApiBusinessError(result.errorCode, result.errorMessage, result.statusCode);
      }

      const dev = result.data;
      const commandResult: CommandResult<Developer> = {
        data: dev,
        note: 'Developer updated',
        text: () =>
          Formatter.keyValue([
            ['ID', dev.id],
            ['Name', dev.name],
            ['Email', dev.email],
            ['Status', dev.status],
          ]),
      };

      // Status / progress lines belong on stderr (table mode only); stdout
      // carries only the payload.
      if (commandResult.note) {
        notify(format, 'success', commandResult.note);
      }
      render(commandResult, { format });
    });
}
