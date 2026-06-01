/**
 * Built-in static capability registry — no backend required.
 *
 * Each entry describes a CLI-exposed service: which `cli_noun` group hosts it,
 * the verbs it offers (with one-line descriptions), the recommended call
 * `workflow`, discovery hints, and its billing mode. `services list` renders a
 * summary of these entries and `services get <service-id>` returns one in full.
 */

/** Billing model for a service. This iteration only ships pay-per-call. */
export type BillingMode = 'pay_per_call';

export interface ServiceBilling {
  mode: BillingMode;
}

export interface ServiceDiscovery {
  /** Command an agent can run to discover the verbs in detail. */
  help_command: string;
}

export interface ServiceCapability {
  service_id: string;
  name: string;
  description: string;
  version: string;
  /** Upstream capability provider. */
  provider: string;
  /** Top-level CLI noun (command group) that hosts this service's verbs. */
  cli_noun: string;
  /** Verb names exposed under `cli_noun`. */
  verbs: string[];
  /** One-line description per verb, keyed by verb name. */
  verb_descriptions: Record<string, string>;
  /** Ordered call sequence; `[cancel]` is optional. */
  workflow: string[];
  /** ISO date the capability became available. */
  since: string;
  discovery: ServiceDiscovery;
  billing: ServiceBilling;
}

/** Static registry. This iteration ships a single `ride` capability. */
export const SERVICE_REGISTRY: ServiceCapability[] = [
  {
    service_id: 'ride',
    name: 'Ride',
    description: 'On-demand ride ordering: quote a fare, book it, poll status, and cancel.',
    version: '1.0.0',
    provider: 'elife',
    cli_noun: 'ride',
    verbs: ['quote', 'book', 'get', 'cancel', 'list-orders'],
    verb_descriptions: {
      quote: 'Request fare quotes for a ride between two points.',
      book: 'Book a ride using a quote_id returned by quote.',
      get: 'Retrieve a ride order by id (poll for status changes).',
      cancel: 'Cancel a ride order by id.',
      'list-orders': 'List previously placed ride orders.',
    },
    workflow: ['quote', 'book', 'get (poll for status)', 'cancel (optional)'],
    since: '2026-06-01',
    discovery: { help_command: 'agenzo-merchant-cli ride --help' },
    billing: { mode: 'pay_per_call' },
  },
];

/** Look up a capability by its service_id. */
export function findService(serviceId: string): ServiceCapability | undefined {
  return SERVICE_REGISTRY.find((s) => s.service_id === serviceId);
}
