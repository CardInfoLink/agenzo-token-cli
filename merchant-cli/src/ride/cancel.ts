import { Command } from 'commander';
import { ApiClient } from '../core/api-client.js';
import { emit, emitSchema, type OutputFormat, type VerbSchema } from '../core/output.js';
import { Formatter, createSpinner } from '../core/formatter.js';
import { PromptEngine } from '../core/prompt-engine.js';
import { resolveIdempotencyKey } from '../utils/idempotency.js';

/** Reserved for `--help --format json`. */
export const cancelSchema: VerbSchema = {
  description: 'Cancel a ride order; may incur a cancellation fee.',
  params: {
    'order-id': 'string — required, order id (a.k.a. ride id) to cancel',
    'idempotency-key': 'string — required, sent as the Idempotency-Key header (never in body)',
  },
  response: {
    ride_id: 'string — cancelled ride id',
    ride_stat: 'string — resulting ride status',
    cancellation: '{ cancellation_fee, reversal_amount, currency }',
  },
};

export function buildCancelCommand(): Command {
  return new Command('cancel')
    .description(cancelSchema.description)
    .helpOption(false)
    .option('--help', 'Show help (add --format json for the machine-readable schema)')
    .option('--format <format>', 'Output format: json|table')
    .option('--api-key <key>', 'API key for runtime requests')
    .option('--yes', 'Skip confirmation prompts')
    .option('--order-id <id>', 'Order id (a.k.a. ride id) to cancel')
    .option('--idempotency-key <key>', 'Caller-supplied idempotency key')
    .action(async (_options, command: Command) => {
      const merged = command.optsWithGlobals();
      const format: OutputFormat = merged.format === 'table' ? 'table' : 'json';

      if (merged.help) {
        const wantsSchema = process.argv.some((a) => a === '--format' || a.startsWith('--format='));
        if (wantsSchema) emitSchema(cancelSchema, format);
        else command.outputHelp();
        return;
      }

      const yes = merged.yes === true;
      const apiKey = await PromptEngine.resolveInput(merged.apiKey, {
        message: 'API key:',
        type: 'password',
      });
      const orderId = await PromptEngine.resolveInput(merged.orderId, { message: 'Order id:' });

      if (!(await PromptEngine.confirm(`Cancel order ${orderId}? This may incur a fee.`, yes))) {
        console.log(Formatter.status('info', 'Cancellation aborted.'));
        return;
      }

      const idempotencyKey = await resolveIdempotencyKey(merged.idempotencyKey, { yes });
      const client = new ApiClient({ apiKey });
      const spinner = createSpinner('Cancelling ride...');
      try {
        const data = await client.post(`/ride/${encodeURIComponent(orderId)}/cancel`, { idempotencyKey });
        spinner.stop();
        emit(data, format);
      } catch (err) {
        spinner.fail('Cancellation failed');
        throw err;
      }
    });
}
