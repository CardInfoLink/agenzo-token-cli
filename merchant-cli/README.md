# @agenzo/merchant-cli

[![npm version](https://img.shields.io/npm/v/@agenzo/merchant-cli)](https://www.npmjs.com/package/@agenzo/merchant-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

CLI tool for AI Agents to order rides and query merchant services. Ships with a
structured [SKILL.md](SKILL.md) so AI Agents can run the full ride flow with zero
extra setup.

[Install](#installation) · [AI Agent Skill](#ai-agent-skill) · [Quick Start](#quick-start) · [Commands](#commands) · [Auth](#authentication)

## Installation

```bash
npm install -g @agenzo/merchant-cli
```

**Requirements**: Node.js 18+

The package installs a single binary, `agenzo-merchant-cli`:

```bash
agenzo-merchant-cli --help
agenzo-merchant-cli --version
```

## AI Agent Skill

This CLI ships with a structured [SKILL.md](SKILL.md) that AI Agents can load to
understand capability discovery, the `quote → book → get → [cancel]` ride flow,
command parameters, and error recovery. Include `SKILL.md` in the agent's context
or tool definition.

## Quick Start

```bash
# 1. (Optional) point at a non-default host
agenzo-merchant-cli config set-host https://agent.everonet.com

# 2. Discover available services
agenzo-merchant-cli services list --api-key sk_xxx

# 3. Get fare quotes for a trip
agenzo-merchant-cli ride-elife quote --api-key sk_xxx \
  --pickup-lat 1.3644 --pickup-lng 103.9915 --pickup-name "Changi Airport" \
  --dropoff-lat 1.2834 --dropoff-lng 103.8607 --dropoff-name "Marina Bay" \
  --pickup-time now

# 4. Book against a returned quote (write op → idempotency key required)
agenzo-merchant-cli --yes ride-elife book --api-key sk_xxx \
  --quote-id <quote_id> --vehicle-class <vehicle_class> \
  --price-amount <amount> --price-currency USD \
  --passenger-name "Ada" --passenger-phone "+6591234567" \
  --pickup-lat 1.3644 --pickup-lng 103.9915 --pickup-name "Changi Airport" \
  --dropoff-lat 1.2834 --dropoff-lng 103.8607 --dropoff-name "Marina Bay" \
  --pickup-time now --idempotency-key idem_001

# 5. Poll the order until a terminal status (NDJSON stream)
agenzo-merchant-cli ride-elife get --order-id <ride_id> --api-key sk_xxx --watch

# 6. Cancel if needed (write op → idempotency key required)
agenzo-merchant-cli --yes ride-elife cancel --order-id <ride_id> --api-key sk_xxx --idempotency-key idem_002

# 7. List all orders
agenzo-merchant-cli ride-elife list-orders --api-key sk_xxx
```

## Commands

| Command | Description |
|---------|-------------|
| `config set-host <url>` | Set the API host (persisted locally) |
| `config reset-host` | Reset the API host to the default |
| `config show` | Show the current configuration |
| `services list` | List available merchant services |
| `services get <service-id>` | Retrieve a single service by id |
| `ride-elife quote` | Request fare quotes between two points |
| `ride-elife book` | Book a ride against a returned quote |
| `ride-elife get <order-id>` | Retrieve a single ride order (add `--watch` to poll until terminal, NDJSON stream) |
| `ride-elife cancel <order-id>` | Cancel a ride order (may incur a fee) |
| `ride-elife list-orders` | List ride orders (paginated, optional status filter) |

### Command Reference

```bash
# Configuration (local only, no network)
agenzo-merchant-cli config set-host https://agent.everonet.com
agenzo-merchant-cli config reset-host
agenzo-merchant-cli config show

# Services registry
agenzo-merchant-cli services list --api-key sk_xxx
agenzo-merchant-cli services get svc_001 --api-key sk_xxx

# Ride flow — quote
agenzo-merchant-cli ride-elife quote --api-key sk_xxx \
  --pickup-lat <lat> --pickup-lng <lng> --pickup-name <name> \
  --dropoff-lat <lat> --dropoff-lng <lng> --dropoff-name <name> \
  --pickup-time <epoch|"now"> \
  [--passenger-name <name>] [--passenger-phone <phone>] \
  [--passenger-count <n>] [--luggage-count <n>] [--children-count <n>]

# Ride flow — book (price-amount/vehicle-class must match the quote response)
agenzo-merchant-cli ride-elife book --api-key sk_xxx \
  --quote-id <id> --vehicle-class <class> \
  --price-amount <amount> --price-currency <USD> \
  --passenger-name <name> --passenger-phone <phone> \
  [--passenger-email <email>] \
  --pickup-lat <lat> --pickup-lng <lng> --pickup-name <name> \
  --dropoff-lat <lat> --dropoff-lng <lng> --dropoff-name <name> \
  --pickup-time <epoch|"now"> \
  [--meet-and-greet] [--welcome-sign <text>] \
  [--arrival-flight-no <no>] [--departure-flight-no <no>] \
  --idempotency-key <key>

# Ride flow — get status
agenzo-merchant-cli ride-elife get --order-id <ride_id> --api-key sk_xxx
agenzo-merchant-cli ride-elife get --order-id <ride_id> --api-key sk_xxx --watch [--watch-interval <s>] [--watch-timeout <s>]

# Ride flow — cancel
agenzo-merchant-cli ride-elife cancel --order-id <ride_id> --api-key sk_xxx --idempotency-key <key>

# Ride flow — list orders
agenzo-merchant-cli ride-elife list-orders --api-key sk_xxx [--status <status>] [--page <n>] [--page-size <n>]
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--format <json\|table>` | Output format. Defaults to `json`; pass `--format table` for a human-readable table. |
| `--api-key <key>` | API key for runtime requests, sent as the `X-API-Key` header. |
| `--idempotency-key <key>` | Caller-supplied idempotency key for write operations (`ride-elife book`, `ride-elife cancel`). |
| `--yes` | Skip confirmation/interactive prompts (for automation / AI Agents). |

### Output format

All commands emit JSON by default, which is ideal for scripting and AI Agents.
Add `--format table` for a readable summary instead:

```bash
agenzo-merchant-cli ride-elife list-orders --api-key sk_xxx --format table
```

### Progress feedback

Ride commands make a network call, so while one is in flight the CLI shows a
spinner (e.g. `⠋ Fetching quotes...`) so you can tell it is working rather than
hung. This feedback is written to **stderr**, never stdout — so piping or
redirecting stdout still yields a clean payload:

```bash
# stdout stays pure JSON; the spinner (on stderr) does not leak in
agenzo-merchant-cli ride-elife quote --api-key sk_xxx ... | jq '.vehicle_classes'
```

The spinner animates only when stderr is an interactive terminal (TTY). When
output is piped, redirected, or run in CI / by an agent, the animation is
suppressed so no control characters end up in logs. Local commands (`config`,
`services`) return instantly and show no spinner.

### Idempotency

Write operations (`ride-elife book`, `ride-elife cancel`) require a caller-supplied
`--idempotency-key`. The CLI **never** auto-generates one:

- Without `--yes`, the CLI prompts for the key interactively.
- With `--yes`, a missing key is a hard error (`PARAM_IDEMPOTENCY_KEY_REQUIRED`).

The key must be 1–128 characters from `[A-Za-z0-9_-]` and is sent as the
`Idempotency-Key` header — never in the request body.

## Authentication

Runtime commands (`services`, `ride-elife`) require `--api-key`. The value is sent on
every request as the `X-API-Key` header. `config` commands are local-only and
need no API key.

## Host configuration

The default API host is `https://agent.everonet.com`. Override it with
`config set-host` (persisted at `~/.agenzo-merchant-cli/config.json`) and revert
with `config reset-host`:

```bash
agenzo-merchant-cli config set-host http://localhost:8000   # local dev
agenzo-merchant-cli config reset-host                        # back to https://agent.everonet.com
agenzo-merchant-cli config show
```

## Error Codes (Ride)

| Code | HTTP | Meaning |
|------|------|---------|
| 1801 | 404 | `VEHICLE_UNAVAILABLE` — No vehicles available for this trip |
| 1802 | 410 | `QUOTE_EXPIRED` — Quote has expired, request a new one |
| 1803 | 502 | `BOOKING_FAILED` — elife rejected the booking (details in response) |
| 1804 | 409 | `CANCELLATION_NOT_ALLOWED` — Cannot cancel in current status |
| 1805 | 404 | `RIDE_NOT_FOUND` — Order not found (or belongs to another org) |
| 1809 | 402 | `ACCOUNT_INSUFFICIENT_BALANCE` — Not enough balance |
| 1811 | 400 | `PRICE_MISMATCH` — price_amount doesn't match the quoted price |
| 1812 | 400 | `VEHICLE_CLASS_MISMATCH` — vehicle_class doesn't match the quote |

When a booking fails (1803), the response `data.elife_details` contains the
upstream error for debugging (e.g. missing required fields).

## Amounts

Monetary amounts are **decimals in the currency's standard unit** (e.g. `12.50`
USD), not minor units / cents.

## Development

```bash
npm install
npm run build      # tsup production build
npm run dev        # watch build
npm run lint       # eslint
```

## License

MIT
