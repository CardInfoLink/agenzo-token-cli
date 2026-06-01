import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const cancelSchema = {
  description: 'Cancel a ride order; may incur a cancellation fee.',
  params: {
    'order-id': 'string — order id to cancel',
    'idempotency-key': 'string — required, caller-supplied write key',
  },
  response: {
    cancellation: '{ cancellation_fee, reversal_amount, currency }',
  },
};

export function buildCancelCommand(): Command {
  return new Command('cancel')
    .description(cancelSchema.description)
    .argument('<order-id>', 'Order id to cancel')
    .option('--idempotency-key <key>', 'Caller-supplied idempotency key')
    .action(() => {
      throw new CliError(ErrorCodes.NOT_IMPLEMENTED, 'ride cancel is not implemented yet.');
    });
}
