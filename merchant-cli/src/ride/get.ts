import { Command } from 'commander';
import { ApiClient } from '../core/api-client.js';
import { emit, emitNdjsonLine, type OutputFormat } from '../core/output.js';
import { createSpinner } from '../core/formatter.js';
import { PromptEngine } from '../core/prompt-engine.js';
import { attachSchemaHelp } from '../utils/cli-help.js';
import type { GetOrderResponse } from '../types/api.js';

/**
 * Terminal ride statuses (schema `polling.terminal_statuses`). Once the order
 * reaches one of these, `--watch` stops polling. Case-sensitive — must match
 * the server casing exactly.
 */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'At destination',
  'Cancelled',
  'Rejected',
  'Customer no show',
  'Driver no show',
]);

/** Schema `polling.recommended_interval_seconds`. */
const DEFAULT_WATCH_INTERVAL_SECONDS = 5;
/** Safety cap so `--watch` can never poll forever. */
const DEFAULT_WATCH_TIMEOUT_SECONDS = 600;

/** Reserved for `--help --format json`. */
export const rideGetSchema = {
  description: 'Retrieve a single ride order status by id (repeatable for polling).',
  params: {
    'order-id': 'string — ride order id (the ride_id returned by `ride-elife book`)',
    watch:
      'boolean — poll until a terminal status, emitting one NDJSON line per update (default off)',
    'watch-interval': `number — seconds between polls when --watch is set (default ${DEFAULT_WATCH_INTERVAL_SECONDS})`,
    'watch-timeout': `number — max seconds to poll before giving up (default ${DEFAULT_WATCH_TIMEOUT_SECONDS})`,
  },
  response: {
    status:
      'OrderStatus — case-sensitive; terminal states: At destination | Cancelled | Rejected | Customer no show | Driver no show',
    from: 'GeoPoint — pickup',
    to: 'GeoPoint — dropoff',
    pickup_time: 'number|string',
    vehicle_class: 'string',
    price: 'Price{amount,currency} — amount is a decimal in the currency standard unit',
    final_amount: 'number — final settled fare (realtime, after final-fare settlement); local-cache path only',
    final_settlement_status: 'string — pending | settled | no_adjustment | settlement_pending | not_applicable (local-cache path)',
    passenger: 'Passenger',
    driver: 'Driver — present after assignment',
    vehicle: 'Vehicle — present after assignment',
  },
};

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function statusOf(data: GetOrderResponse): string | undefined {
  return (data as { status?: string }).status;
}

export function buildRideGetCommand(): Command {
  const cmd = new Command('get')
    .description(rideGetSchema.description)
    .option('--order-id <id>', 'Ride order id (the ride_id returned by `ride-elife book`)')
    .option('--watch', 'Poll until a terminal status, emitting one NDJSON line per update')
    .option('--watch-interval <seconds>', 'Seconds between polls when --watch is set')
    .option('--watch-timeout <seconds>', 'Max seconds to poll before giving up')
    .action(async (_opts, command: Command) => {
      const o = command.optsWithGlobals();
      const format: OutputFormat = o.format === 'table' ? 'table' : 'json';
      const apiKey = await PromptEngine.resolveInput(o.apiKey, {
        message: 'API key:',
        type: 'password',
      });
      const orderId = await PromptEngine.resolveInput(o.orderId, { message: 'Order id:' });
      const client = new ApiClient({ apiKey });
      const path = `/ride/${encodeURIComponent(orderId)}/status`;

      if (o.watch) {
        await watchUntilTerminal(client, path, {
          intervalMs: num(o.watchInterval, DEFAULT_WATCH_INTERVAL_SECONDS) * 1000,
          timeoutMs: num(o.watchTimeout, DEFAULT_WATCH_TIMEOUT_SECONDS) * 1000,
        });
        return;
      }

      const spinner = createSpinner('Fetching ride status...');
      try {
        const data = await client.get<GetOrderResponse>(path);
        spinner.stop();
        emit(data, format);
      } catch (err) {
        spinner.fail('Failed to fetch ride status');
        throw err;
      }
    });

  return attachSchemaHelp(cmd, rideGetSchema);
}

/**
 * Poll the status endpoint, writing each result as an NDJSON line on stdout
 * until the order reaches a terminal status or the timeout elapses. Progress
 * is the NDJSON stream itself, so no spinner is shown (stdout stays a clean
 * line stream an agent can consume incrementally). A network/backend error
 * propagates to the top-level handler exactly like the single-shot path.
 */
async function watchUntilTerminal(
  client: ApiClient,
  path: string,
  opts: { intervalMs: number; timeoutMs: number },
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  for (;;) {
    const data = await client.get<GetOrderResponse>(path);
    emitNdjsonLine(data);

    const status = statusOf(data);
    if (status !== undefined && TERMINAL_STATUSES.has(status)) return;

    if (Date.now() + opts.intervalMs >= deadline) {
      emitNdjsonLine({
        watch_status: 'timeout',
        message: `Polling stopped after ${opts.timeoutMs / 1000}s without reaching a terminal status.`,
        last_status: status ?? null,
      });
      return;
    }
    await sleep(opts.intervalMs);
  }
}
