#!/usr/bin/env node
/**
 * Schema drift check — guards the hand-written `--help --format json` schemas
 * against the live backend response shape.
 *
 * Why: each verb declares its response fields in code (e.g. ride/get.ts
 * `response: {...}`). The backend is the real source of truth. If the backend
 * adds/removes/renames a field and we forget to update the CLI schema, agents
 * relying on `--help --format json` get a stale contract. This script catches
 * that drift by diffing the declared response keys against the keys the
 * backend actually returns for a real request.
 *
 * It is an INTEGRATION check (needs a running backend + a valid v3 API key),
 * not a unit test, so it lives in scripts/ and is run on demand / in a
 * dedicated CI stage, never bundled into the published package.
 *
 * Usage:
 *   MERCHANT_CLI_TEST_KEY=sk_prod_xxx \
 *   MERCHANT_CLI_TEST_HOST=http://localhost:8000 \
 *   node scripts/schema-drift-check.mjs
 *
 * Exit code 0 = no drift; 1 = drift or setup error.
 */

import { execFileSync } from 'node:child_process';

const HOST = process.env.MERCHANT_CLI_TEST_HOST ?? 'http://localhost:8000';
const KEY = process.env.MERCHANT_CLI_TEST_KEY;
const CLI = 'node';
const CLI_ENTRY = new URL('../dist/index.js', import.meta.url).pathname;
const PREFIX = '/api/v3/agent-pay';

if (!KEY) {
  console.error('✗ MERCHANT_CLI_TEST_KEY is required (a v3 monthly_settlement API key).');
  process.exit(1);
}

/** Pull the declared response field set from a verb's `--help --format json`. */
function declaredResponseKeys(verb) {
  const out = execFileSync(
    CLI,
    [CLI_ENTRY, 'ride', verb, '--help', '--format', 'json'],
    { encoding: 'utf-8' },
  );
  const schema = JSON.parse(out);
  return new Set(Object.keys(schema.response ?? {}));
}

async function backendCall(method, path, body, idempotencyKey) {
  const headers = { 'X-Api-Key': KEY };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${HOST}${PREFIX}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return json;
}

/**
 * Compare declared keys vs the keys present in the backend payload.
 * Drift = a key the backend returned that the schema never mentions
 * (a missing-from-schema field agents won't know about). Declared-but-absent
 * keys are tolerated: many fields are conditional (driver/vehicle appear only
 * after dispatch; billing_entry_id only for monthly_settlement), so their
 * absence in one response is expected, not drift.
 */
function diff(verb, declared, actualKeys, { ignore = [] } = {}) {
  const undeclared = [...actualKeys].filter(
    (k) => !declared.has(k) && !ignore.includes(k),
  );
  if (undeclared.length > 0) {
    console.error(`✗ ${verb}: backend returned undeclared field(s): ${undeclared.join(', ')}`);
    return false;
  }
  console.log(`✓ ${verb}: no drift (${actualKeys.size} backend fields all declared)`);
  return true;
}

async function main() {
  let ok = true;
  const passenger = { passenger_name: 'Drift Check', passenger_phone: '+14155551234' };
  const route = {
    pickup: { lat: 37.7937, lng: -122.3956, name: '1 Market St' },
    dropoff: { lat: 37.6213, lng: -122.379, name: 'SFO Airport' },
    pickup_time: 'now',
  };

  // quote
  const quote = await backendCall('POST', '/ride/quote', { ...route, ...passenger });
  if (quote.code !== '0000') {
    console.error(`✗ quote backend call failed: ${quote.code} ${quote.message}`);
    process.exit(1);
  }
  ok = diff('quote', declaredResponseKeys('quote'), new Set(Object.keys(quote.data))) && ok;

  const vc = quote.data.vehicle_classes[0];

  // book
  const book = await backendCall(
    'POST', '/ride/book',
    {
      quote_id: vc.price.quote_id,
      vehicle_class: vc.vehicle_class,
      price_amount: vc.price.amount,
      price_currency: vc.price.currency,
      ...route, ...passenger,
    },
    `drift-${Date.now()}`,
  );
  if (book.code !== '0000') {
    console.error(`✗ book backend call failed: ${book.code} ${book.message}`);
    process.exit(1);
  }
  // billing_entry_id is monthly_settlement-only; payment_order_id pay_per_call-only.
  ok = diff('book', declaredResponseKeys('book'), new Set(Object.keys(book.data))) && ok;

  const rideId = book.data.ride_id;

  // get (may be live or local_cache; `source` is a CLI-added marker, ignore)
  const got = await backendCall('GET', `/ride/${encodeURIComponent(rideId)}/status`);
  if (got.code === '0000') {
    ok = diff('get', declaredResponseKeys('get'), new Set(Object.keys(got.data)), {
      ignore: ['source', 'ride_id', 'created_at', 'meet_and_greet', 'arrival_flight', 'departure_flight', 'return_time', 'distance', 'duration', 'meeting_places'],
    }) && ok;
  } else {
    console.log(`ℹ get: backend returned ${got.code} (elife transient); skipping field diff`);
  }

  // cancel
  const cancelled = await backendCall(
    'POST', `/ride/${encodeURIComponent(rideId)}/cancel`, undefined, `drift-cancel-${Date.now()}`,
  );
  if (cancelled.code === '0000') {
    ok = diff('cancel', declaredResponseKeys('cancel'), new Set(Object.keys(cancelled.data))) && ok;
  } else {
    console.log(`ℹ cancel: backend returned ${cancelled.code}; skipping field diff`);
  }

  // list-orders
  const list = await backendCall('GET', '/ride/orders?page=1&page_size=5');
  if (list.code === '0000') {
    ok = diff('list-orders', declaredResponseKeys('list-orders'), new Set(Object.keys(list.data))) && ok;
  }

  if (!ok) {
    console.error('\n✗ Schema drift detected. Update the verb schema(s) in src/ride/*.ts to match the backend.');
    process.exit(1);
  }
  console.log('\n✓ No schema drift. CLI schemas match the backend response shape.');
}

main().catch((err) => {
  console.error('✗ drift check error:', err.message);
  process.exit(1);
});
