import { Command } from 'commander';
import { CliError, ErrorCodes } from '../core/errors.js';

/** Reserved for `--help --format json`. */
export const quoteSchema = {
  description: 'Request fare quotes for a ride between two points.',
  params: {
    'pickup-lat': 'number — pickup latitude',
    'pickup-lng': 'number — pickup longitude',
    'pickup-name': 'string — pickup location name',
    'dropoff-lat': 'number — dropoff latitude',
    'dropoff-lng': 'number — dropoff longitude',
    'dropoff-name': 'string — dropoff location name',
    'service-id': 'string — optional service registry id',
  },
  response: {
    vehicle_classes: 'VehicleClass[] — available classes, each with price.quote_id',
  },
};

export function buildQuoteCommand(): Command {
  return new Command('quote')
    .description(quoteSchema.description)
    .option('--pickup-lat <lat>', 'Pickup latitude')
    .option('--pickup-lng <lng>', 'Pickup longitude')
    .option('--pickup-name <name>', 'Pickup location name')
    .option('--dropoff-lat <lat>', 'Dropoff latitude')
    .option('--dropoff-lng <lng>', 'Dropoff longitude')
    .option('--dropoff-name <name>', 'Dropoff location name')
    .option('--service-id <id>', 'Service registry id')
    .action(() => {
      throw new CliError(ErrorCodes.NOT_IMPLEMENTED, 'ride quote is not implemented yet.');
    });
}
