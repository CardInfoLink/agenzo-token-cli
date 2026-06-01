import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const bookSchema = {
  description: 'Book a ride against a previously returned quote.',
  params: {
    'quote-id': 'string — quote id from `ride quote`',
    'vehicle-class': 'string — chosen vehicle class',
    'passenger-name': 'string — passenger full name',
    'passenger-phone': 'string — optional passenger phone',
    'passenger-email': 'string — optional passenger email',
    'idempotency-key': 'string — required, caller-supplied write key',
  },
  response: {
    order_id: 'string — created order id',
    status: 'OrderStatus — initial order status',
  },
};

export function buildBookCommand(): Command {
  return new Command('book')
    .description(bookSchema.description)
    .option('--quote-id <id>', 'Quote id from `ride quote`')
    .option('--vehicle-class <class>', 'Chosen vehicle class')
    .option('--passenger-name <name>', 'Passenger full name')
    .option('--passenger-phone <phone>', 'Passenger phone')
    .option('--passenger-email <email>', 'Passenger email')
    .option('--idempotency-key <key>', 'Caller-supplied idempotency key')
    .action(() => {
      throw new CliError(ErrorCodes.NOT_IMPLEMENTED, 'ride book is not implemented yet.');
    });
}
