/*
 * Booking funding is decided server-side by the developer's billing_mode:
 *   - monthly_settlement: no payment handle; fare is deducted from the
 *     developer's settlement account (payment_status=ON_ACCOUNT).
 *   - pay_per_call: pass --payment-order-id (a PAID order from payment-cli).
 *     Reserved — gated server-side until payment-cli ships (BACK-040).
 * The CLI no longer accepts --payment-method-id (the merchant domain never
 * holds a payment credential).
 */
import { Command } from 'commander';
import { ApiClient } from '../core/api-client.js';
import { emit, emitSchema, type OutputFormat, type VerbSchema } from '../core/output.js';
import { Formatter, createSpinner } from '../core/formatter.js';
import { PromptEngine } from '../core/prompt-engine.js';
import { resolveIdempotencyKey } from '../utils/idempotency.js';

/** Reserved for `--help --format json`. */
export const bookSchema: VerbSchema = {
  description: 'Book a ride against a previously returned quote.',
  params: {
    'quote-id': 'string — required, quote id from `ride quote`',
    'vehicle-class': 'string — required, chosen vehicle class',
    'price-amount': 'number — required, fare in decimal currency units (not cents)',
    'price-currency': 'string — currency code (default USD)',
    'payment-order-id': 'string — conditional. Required for pay_per_call billing (a PAID order from payment-cli); omit for monthly_settlement (deducted from the settlement account)',
    'passenger-name': 'string — required, passenger full name',
    'passenger-phone': 'string — required, passenger phone',
    'passenger-email': 'string — optional passenger email',
    'luggage-count': 'number — optional luggage count',
    'special-requests': 'string — optional free-text requests',
    'pickup-lat': 'number — required, pickup latitude',
    'pickup-lng': 'number — required, pickup longitude',
    'pickup-name': 'string — required, pickup location name',
    'dropoff-lat': 'number — required, dropoff latitude',
    'dropoff-lng': 'number — required, dropoff longitude',
    'dropoff-name': 'string — required, dropoff location name',
    'pickup-time': 'number|string — required, epoch seconds or "now" (must match quote)',
    'meet-and-greet': 'boolean — optional meet & greet service',
    'meet-and-greet-price': 'number — optional meet & greet surcharge',
    'welcome-sign': 'string — optional welcome sign text',
    'arrival-flight-no': 'string — optional arrival flight number',
    'arrival-airline': 'string — optional arrival airline',
    'departure-flight-no': 'string — optional departure flight number',
    'departure-airline': 'string — optional departure airline',
    'idempotency-key': 'string — required, sent as the Idempotency-Key header (never in body)',
  },
  response: {
    ride_id: 'string — booked ride id, used by `ride get` / `ride cancel`',
    order_id: 'string — internal ride order id (rio_...)',
    status: 'string — initial ride status (e.g. INIT / Pending)',
    price: '{ amount, currency, quote_id } — confirmed fare',
    payment_status: 'string — ON_ACCOUNT (monthly_settlement) or PAID (pay_per_call)',
    billing_entry_id: 'string — settlement ledger entry id (monthly_settlement only)',
  },
};

export function buildBookCommand(): Command {
  return new Command('book')
    .description(bookSchema.description)
    .helpOption(false)
    .option('--help', 'Show help (add --format json for the machine-readable schema)')
    .option('--format <format>', 'Output format: json|table')
    .option('--api-key <key>', 'API key for runtime requests')
    .option('--yes', 'Skip confirmation prompts')
    .option('--quote-id <id>', 'Quote id from `ride quote`')
    .option('--vehicle-class <class>', 'Chosen vehicle class')
    .option('--price-amount <amount>', 'Fare in decimal currency units (not cents)')
    .option('--price-currency <currency>', 'Currency code (default USD)')
    .option('--payment-order-id <id>', 'Paid payment order id (pay_per_call mode only)')
    .option('--passenger-name <name>', 'Passenger full name')
    .option('--passenger-phone <phone>', 'Passenger phone')
    .option('--passenger-email <email>', 'Passenger email')
    .option('--luggage-count <n>', 'Luggage count')
    .option('--special-requests <text>', 'Free-text special requests')
    .option('--pickup-lat <lat>', 'Pickup latitude')
    .option('--pickup-lng <lng>', 'Pickup longitude')
    .option('--pickup-name <name>', 'Pickup location name')
    .option('--dropoff-lat <lat>', 'Dropoff latitude')
    .option('--dropoff-lng <lng>', 'Dropoff longitude')
    .option('--dropoff-name <name>', 'Dropoff location name')
    .option('--pickup-time <time>', 'Pickup time: epoch seconds, or "now"')
    .option('--meet-and-greet', 'Enable meet & greet service')
    .option('--meet-and-greet-price <amount>', 'Meet & greet surcharge')
    .option('--welcome-sign <text>', 'Welcome sign text')
    .option('--arrival-flight-no <no>', 'Arrival flight number')
    .option('--arrival-airline <airline>', 'Arrival airline')
    .option('--departure-flight-no <no>', 'Departure flight number')
    .option('--departure-airline <airline>', 'Departure airline')
    .option('--idempotency-key <key>', 'Caller-supplied idempotency key')
    .action(async (_options, command: Command) => {
      const merged = command.optsWithGlobals();
      const format: OutputFormat = merged.format === 'table' ? 'table' : 'json';

      if (merged.help) {
        const wantsSchema = process.argv.some((a) => a === '--format' || a.startsWith('--format='));
        if (wantsSchema) emitSchema(bookSchema, format);
        else command.outputHelp();
        return;
      }

      const yes = merged.yes === true;
      const apiKey = await PromptEngine.resolveInput(merged.apiKey, {
        message: 'API key:',
        type: 'password',
      });
      const quoteId = await PromptEngine.resolveInput(merged.quoteId, { message: 'Quote id:' });
      const vehicleClass = await PromptEngine.resolveInput(merged.vehicleClass, {
        message: 'Vehicle class:',
      });
      const priceAmount = await PromptEngine.resolveInput(merged.priceAmount, {
        message: 'Price amount (decimal):',
      });
      const passengerName = await PromptEngine.resolveInput(merged.passengerName, {
        message: 'Passenger name:',
      });
      const passengerPhone = await PromptEngine.resolveInput(merged.passengerPhone, {
        message: 'Passenger phone:',
      });

      const body: Record<string, unknown> = {
        quote_id: quoteId,
        vehicle_class: vehicleClass,
        price_amount: Number(priceAmount),
        price_currency: merged.priceCurrency ?? 'USD',
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
      };
      // Funding is decided server-side by the developer's billing_mode:
      // - monthly_settlement: no payment handle (deducted from the account)
      // - pay_per_call: --payment-order-id (a PAID order from payment-cli)
      // Both flags are optional here; the backend rejects the wrong one.
      if (merged.paymentOrderId) body.payment_order_id = merged.paymentOrderId;
      if (merged.passengerEmail) body.passenger_email = merged.passengerEmail;
      if (merged.luggageCount !== undefined) body.luggage_count = Number(merged.luggageCount);
      if (merged.specialRequests) body.special_requests = merged.specialRequests;
      if (merged.pickupLat || merged.pickupLng || merged.pickupName) {
        body.pickup = { lat: Number(merged.pickupLat), lng: Number(merged.pickupLng), name: merged.pickupName };
      }
      if (merged.dropoffLat || merged.dropoffLng || merged.dropoffName) {
        body.dropoff = { lat: Number(merged.dropoffLat), lng: Number(merged.dropoffLng), name: merged.dropoffName };
      }
      if (merged.pickupTime) body.pickup_time = merged.pickupTime;
      if (merged.meetAndGreet) body.meet_and_greet = true;
      if (merged.meetAndGreetPrice !== undefined) body.meet_and_greet_price = Number(merged.meetAndGreetPrice);
      if (merged.welcomeSign) body.welcome_sign = merged.welcomeSign;
      if (merged.arrivalFlightNo || merged.arrivalAirline) {
        body.arrival_flight = { flight_no: merged.arrivalFlightNo, airline: merged.arrivalAirline };
      }
      if (merged.departureFlightNo || merged.departureAirline) {
        body.departure_flight = { flight_no: merged.departureFlightNo, airline: merged.departureAirline };
      }

      if (!(await PromptEngine.confirm(`Book ride with quote ${quoteId}?`, yes))) {
        console.log(Formatter.status('info', 'Booking aborted.'));
        return;
      }

      const idempotencyKey = await resolveIdempotencyKey(merged.idempotencyKey, { yes });
      const client = new ApiClient({ apiKey });
      const spinner = createSpinner('Booking ride...');
      try {
        const data = await client.post('/ride/book', { body, idempotencyKey });
        spinner.stop();
        emit(data, format);
      } catch (err) {
        spinner.fail('Booking failed');
        throw err;
      }
    });
}
