# @agenzo/merchant-cli — AI Agent Skill

CLI for ordering rides and querying merchant services. This skill tells an AI
Agent how to discover capabilities and drive the full ride lifecycle.

## Setup

- Binary: `agenzo-merchant-cli`
- Auth: every runtime command needs `--api-key <key>` (sent as `X-API-Key`).
- Output: JSON by default (machine-readable). Add `--format table` only for
  human display.
- Streams: parse **stdout** for results. Progress spinners and status lines go
  to **stderr** and never contaminate stdout — read only stdout as data. (The
  spinner is auto-suppressed when stderr is not a TTY, e.g. agent-invoked.)
- Automation: pass `--yes` to skip interactive prompts. In `--yes` mode every
  required value must be supplied via flags.
- Host: defaults to `https://agent.everonet.com`. Change with
  `config set-host <url>`; reset with `config reset-host`.
- **Amounts are decimals in the currency's standard unit** (e.g. `12.50` USD),
  never minor units / cents.

## Capability discovery

Before quoting, discover which services exist and are enabled:

```bash
agenzo-merchant-cli services list --api-key sk_xxx
agenzo-merchant-cli services get <service-id> --api-key sk_xxx
```

- `services list` → `{ services: Service[] }`. Each `Service` has
  `service_id`, `name`, `provider`, `cli_noun`, `version`, `verbs`.
- `services get <service-id>` → a single service capability (adds
  `description`, `verb_descriptions`, `workflow`, `since`, `discovery`). A
  missing/unknown id raises `SERVICE_NOT_FOUND`.
- Use a discovered `service_id` as the optional `--service-id` on `ride-elife quote`.

> Note: `services` is a CLI-bundled catalog, not a live per-key feed. Whether a
> developer pays per call or by monthly settlement is decided by the backend and
> surfaced in the `ride-elife book` response (`payment_status`) / error codes —
> it is not advertised by `services`.

## Ride workflow (closed loop)

The ride lifecycle is `quote → book → get (poll) → [cancel]`.

```
quote ──► book ──► get (poll until terminal) ──► [cancel if still active]
```

### 1. quote

Request fare quotes for a trip between two points.

```bash
agenzo-merchant-cli ride-elife quote --api-key sk_xxx \
  --pickup-lat <num> --pickup-lng <num> --pickup-name <str> \
  --dropoff-lat <num> --dropoff-lng <num> --dropoff-name <str> \
  [--service-id <id>]
```

Returns `{ vehicle_classes: VehicleClass[] }`. Each class carries
`vehicle_class`, `passenger_capacity`, `luggage_capacity`, and a `price` with
`amount`, `currency`, and a `quote_id`. **Carry `quote_id` and the chosen
`vehicle_class` into `book`.** Quotes expire — book promptly.

### 2. book (write — idempotency key required)

```bash
agenzo-merchant-cli --yes ride-elife book --api-key sk_xxx \
  --quote-id <id> --vehicle-class <class> --passenger-name <name> \
  [--passenger-phone <phone>] [--passenger-email <email>] \
  --idempotency-key <key>
```

Returns an order with `ride_id`, `order_id`, initial `status`, plus
`is_scheduled` (true = scheduled/airport, false = realtime) and `order_type`
(`realtime` / `airport`, derived from `pickup-time`). Reuse the **same**
`--idempotency-key` if you retry the same booking, so a network retry never
creates a duplicate order.

> Realtime rides (`pickup-time=now`) are charged the quoted price at booking,
> then reconciled to the actual fare after the trip ends (backend adjusts the
> settlement balance). Scheduled/airport rides have a fixed price and are not
> reconciled.

### 3. get (poll)

```bash
agenzo-merchant-cli ride-elife get --order-id <id> --api-key sk_xxx
```

Returns the ride status. Poll periodically until a terminal status.

- Active (keep polling): `Pending`, `Accepted`, `On my way`, `Waiting`, `On board`
- Terminal (stop): `At destination`, `Rejected`, `Cancelled`,
  `Customer no show`, `Driver no show`

Status strings are case-sensitive — match the server casing exactly.

**Auto-poll with `--watch`** (preferred for agents): instead of looping `get`
yourself, pass `--watch` to poll until a terminal status. Each update is emitted
as one **NDJSON line** on stdout (one JSON object per line — read it with a line
reader, not a single `JSON.parse`). Polling stops at a terminal status or the
timeout.

```bash
agenzo-merchant-cli ride-elife get --order-id <id> --api-key sk_xxx \
  --watch [--watch-interval <seconds>] [--watch-timeout <seconds>]
```

- `--watch-interval` defaults to 5 seconds, `--watch-timeout` to 600 seconds.
- On timeout the final NDJSON line is `{ "watch_status": "timeout", ... }`
  instead of an order status.

### 4. cancel (optional, write — idempotency key required)

```bash
agenzo-merchant-cli --yes ride-elife cancel <order-id> --api-key sk_xxx \
  --idempotency-key <key>
```

Only while the order is still active. Returns
`{ ride_id, ride_stat, cancellation: { cancellation_fee, reversal_amount, currency }, refund_amount }`
— `refund_amount` is what was credited back to the settlement balance
(paid − cancellation_fee); a cancellation may incur a fee.

### Listing

```bash
agenzo-merchant-cli ride-elife list-orders --api-key sk_xxx \
  [--status <status>] [--page <n>] [--page-size <n>]
```

Returns `{ orders, total, page, page_size }` (default `page` 1, `page-size` 20).
Each order includes `is_scheduled`, `scheduled_at`, `price_amount`,
`final_amount` (settled fare; equals `price_amount` until final-fare settlement
runs), `final_settlement_status` (`pending` / `settled` / `no_adjustment` /
`settlement_pending` / `not_applicable`), and `cancellation_fee`.

## Idempotency rule

All write operations (`ride-elife book`, `ride-elife cancel`) require a caller-supplied
`--idempotency-key`. The CLI never auto-generates one.

- Key format: 1–128 chars from `[A-Za-z0-9_-]`, sent as the `Idempotency-Key`
  header (not in the body).
- With `--yes` and no key → hard error `PARAM_IDEMPOTENCY_KEY_REQUIRED`.
- Without `--yes` → the CLI prompts for the key.

## Error codes & recovery

Errors are emitted with a SCREAMING_SNAKE_CASE `code`. Common ones:

| Code | Meaning | Recovery |
|------|---------|----------|
| `QUOTE_EXPIRED` | The `quote_id` is no longer valid | Re-run `ride-elife quote` and book with the fresh `quote_id`. |
| `VEHICLE_UNAVAILABLE` | The chosen `vehicle_class` is unavailable | Re-quote and pick another `vehicle_class` from `vehicle_classes`. |
| `BOOKING_FAILED` | Booking could not be completed | Re-quote, then retry `book` with a fresh quote and the same idempotency key. |
| `CANCELLATION_NOT_ALLOWED` | Order can't be cancelled (terminal/too late) | Re-check status via `ride-elife get`; no action if already terminal. |
| `SERVICE_NOT_FOUND` | Unknown `service_id` | Re-run `services list` and use a valid, enabled `service_id`. |
| `PARAM_IDEMPOTENCY_KEY_REQUIRED` | Missing/invalid idempotency key on a write op | Pass a valid `--idempotency-key` (1–128 chars, `[A-Za-z0-9_-]`). |

Other codes you may see: `NETWORK_ERROR` / `TIMEOUT` (retry, check host),
`CLI_OUTDATED` (upgrade the CLI), `CONFIG_ERROR` (fix/reset local config).
