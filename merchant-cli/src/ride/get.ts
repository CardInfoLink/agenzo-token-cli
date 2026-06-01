import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const rideGetSchema = {
  description: 'Retrieve a single ride order by id.',
  params: {
    'order-id': 'string — order id to retrieve',
  },
  response: {
    order_id: 'string',
    status: 'OrderStatus',
  },
};

export function buildRideGetCommand(): Command {
  return new Command('get')
    .description(rideGetSchema.description)
    .argument('<order-id>', 'Order id to retrieve')
    .action(() => {
      throw new CliError(ErrorCodes.NOT_IMPLEMENTED, 'ride get is not implemented yet.');
    });
}
