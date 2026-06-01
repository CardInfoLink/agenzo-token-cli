import { Command } from 'commander';
import { ApiClient } from '../core/api-client.js';
import { emit, type OutputFormat } from '../core/output.js';
import { PromptEngine } from '../core/prompt-engine.js';
import { attachSchemaHelp } from '../utils/cli-help.js';
import type { GetOrderResponse } from '../types/api.js';

/** Reserved for `--help --format json`. */
export const rideGetSchema = {
  description: 'Retrieve a single ride order status by id (repeatable for polling).',
  params: {
    'order-id': 'string — ride order id (the ride_id returned by `ride book`)',
  },
  response: {
    status:
      'OrderStatus — case-sensitive; terminal states: At destination | Cancelled | Rejected | Customer no show | Driver no show',
    from: 'GeoPoint — pickup',
    to: 'GeoPoint — dropoff',
    pickup_time: 'number|string',
    vehicle_class: 'string',
    price: 'Price{amount,currency} — amount is a decimal in the currency standard unit',
    passenger: 'Passenger',
    driver: 'Driver — present after assignment',
    vehicle: 'Vehicle — present after assignment',
  },
};

export function buildRideGetCommand(): Command {
  const cmd = new Command('get')
    .description(rideGetSchema.description)
    .option('--order-id <id>', 'Ride order id (the ride_id returned by `ride book`)')
    .action(async (_opts, command: Command) => {
      const o = command.optsWithGlobals();
      const format: OutputFormat = o.format === 'table' ? 'table' : 'json';
      const apiKey = await PromptEngine.resolveInput(o.apiKey, {
        message: 'API key:',
        type: 'password',
      });
      const orderId = await PromptEngine.resolveInput(o.orderId, { message: 'Order id:' });

      const client = new ApiClient({ apiKey });
      const data = await client.get<GetOrderResponse>(
        `/rides/${encodeURIComponent(orderId)}/status`,
      );
      emit(data, format);
    });

  return attachSchemaHelp(cmd, rideGetSchema);
}
