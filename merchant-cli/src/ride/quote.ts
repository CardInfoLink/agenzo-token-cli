import { Command } from 'commander';
import { ApiClient } from '../core/api-client.js';
import { CliError } from '../core/errors.js';
import { emit, type OutputFormat } from '../core/output.js';
import { createSpinner } from '../core/formatter.js';
import { PromptEngine } from '../core/prompt-engine.js';
import { attachSchemaHelp } from '../utils/cli-help.js';
import type { QuoteResponse } from '../types/api.js';

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
    'pickup-time': 'number|string — epoch seconds, or "now"',
    'passenger-name': 'string — lead passenger full name',
    'passenger-phone': 'string — passenger phone in E.164 format',
    'passenger-count': 'number — optional passenger count',
    'luggage-count': 'number — optional luggage count',
    'passenger-email': 'string — optional passenger email',
    'children-count': 'number — optional children count',
  },
  response: {
    vehicle_classes:
      'VehicleClass[] — each: vehicle_class, price{amount,currency,quote_id}, passenger_capacity, luggage_capacity (amount is a decimal in the currency standard unit, e.g. 42.50 = $42.50)',
    meet_and_greet: 'object|null — { available: boolean, price: { amount, currency } } when applicable',
    is_airport_transfer: 'boolean',
    airport_direction: 'string|null — pickup/dropoff direction for airport transfers',
  },
};

function need(value: string | undefined, flag: string): string {
  if (value === undefined) throw new CliError('PARAM_REQUIRED', `Missing required --${flag}.`);
  return value;
}

function num(value: string | undefined, flag: string): number {
  const n = Number(need(value, flag));
  if (!Number.isFinite(n)) throw new CliError('PARAM_INVALID', `--${flag} must be a number.`);
  return n;
}

export function buildQuoteCommand(): Command {
  const cmd = new Command('quote')
    .description(quoteSchema.description)
    .option('--pickup-lat <lat>', 'Pickup latitude')
    .option('--pickup-lng <lng>', 'Pickup longitude')
    .option('--pickup-name <name>', 'Pickup location name')
    .option('--dropoff-lat <lat>', 'Dropoff latitude')
    .option('--dropoff-lng <lng>', 'Dropoff longitude')
    .option('--dropoff-name <name>', 'Dropoff location name')
    .option('--pickup-time <time>', 'Pickup time: epoch seconds, or "now"')
    .option('--passenger-name <name>', 'Lead passenger full name')
    .option('--passenger-phone <phone>', 'Passenger phone (E.164)')
    .option('--passenger-count <n>', 'Passenger count')
    .option('--luggage-count <n>', 'Luggage count')
    .option('--passenger-email <email>', 'Passenger email')
    .option('--children-count <n>', 'Children count')
    .action(async (_opts, command: Command) => {
      const o = command.optsWithGlobals();
      const format: OutputFormat = o.format === 'table' ? 'table' : 'json';
      const apiKey = await PromptEngine.resolveInput(o.apiKey, {
        message: 'API key:',
        type: 'password',
      });

      const body: Record<string, unknown> = {
        pickup: {
          lat: num(o.pickupLat, 'pickup-lat'),
          lng: num(o.pickupLng, 'pickup-lng'),
          name: need(o.pickupName, 'pickup-name'),
        },
        dropoff: {
          lat: num(o.dropoffLat, 'dropoff-lat'),
          lng: num(o.dropoffLng, 'dropoff-lng'),
          name: need(o.dropoffName, 'dropoff-name'),
        },
        pickup_time: o.pickupTime === 'now' ? 'now' : num(o.pickupTime, 'pickup-time'),
        passenger_name: need(o.passengerName, 'passenger-name'),
        passenger_phone: need(o.passengerPhone, 'passenger-phone'),
      };
      if (o.passengerCount !== undefined) body.passenger_count = num(o.passengerCount, 'passenger-count');
      if (o.luggageCount !== undefined) body.luggage_count = num(o.luggageCount, 'luggage-count');
      if (o.childrenCount !== undefined) body.children_count = num(o.childrenCount, 'children-count');
      if (o.passengerEmail !== undefined) body.passenger_email = o.passengerEmail;

      const client = new ApiClient({ apiKey });
      const spinner = createSpinner('Fetching quotes...');
      try {
        const data = await client.post<QuoteResponse>('/ride/quote', { body });
        spinner.stop();
        emit(data, format);
      } catch (err) {
        spinner.fail('Quote request failed');
        throw err;
      }
    });

  return attachSchemaHelp(cmd, quoteSchema);
}
