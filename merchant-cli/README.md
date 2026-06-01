# agenzo-merchant-cli

CLI tool for AI Agents to order rides and query merchant services. Ships with a
structured [SKILL.md](SKILL.md) so AI Agents can run the full ride flow with zero
extra setup.

[Install](#installation) · [AI Agent Skill](#ai-agent-skill) · [Quick Start](#quick-start) · [Commands](#commands) · [Auth](#authentication)

## Installation

```bash
npm install -g agenzo-merchant-cli
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
agenzo-merchant-cli ride quote --api-key sk_xxx \
  --pickup-lat 1.3 --pickup-lng 103.8 --pickup-name "Changi" \
  --dropoff-lat 1.29 --dropoff-lng 103.85 --dropoff-name "Marina Bay"

# 4. Book against a returned quote (write op → idempotency key required)
agenzo-merchant-cli --yes ride book --api-key sk_xxx \
  --quote-id qt_123 --vehicle-class standard \
  --passenger-name "Ada" --idempotency-key idem_001

# 5. Poll the order until a terminal status
agenzo-merchant-cli ride get ord_123 --api-key sk_xxx

# 6. Cancel if needed (write op → idempotency key required)
agenzo-merchant-cli --yes ride cancel ord_123 --api-key sk_xxx --idempotency-key idem_002
```

## Commands

| Command | Description |
|---------|-------------|
| `config set-host <url>` | Set the API host (persisted locally) |
| `config reset-host` | Reset the API host to the default |
| `config show` | Show the current configuration |
| `services list` | List available merchant services |
| `services get <service-id>` | Retrieve a single service by id |
| `ride quote` | Request fare quotes between two points |
| `ride book` | Book a ride against a returned quote |
| `ride get <order-id>` | Retrieve a single ride order |
| `ride cancel <order-id>` | Cancel a ride order (may incur a fee) |
| `ride list-orders` | List ride orders (paginated, optional status filter) |

### Command Reference

```bash
# Configuration (local only, no network)
agenzo-merchant-cli config set-host https://agent.everonet.com
agenzo-merchant-cli config reset-host
agenzo-merchant-cli config show

# Services registry
agenzo-merchant-cli services list --api-key sk_xxx
agenzo-merchant-cli services get svc_001 --api-key sk_xxx

# Ride flow
agenzo-merchant-cli ride quote --api-key sk_xxx \
  --pickup-lat <lat> --pickup-lng <lng> --pickup-name <name> \
  --dropoff-lat <lat> --dropoff-lng <lng> --dropoff-name <name> [--service-id <id>]
agenzo-merchant-cli ride book --api-key sk_xxx \
  --quote-id <id> --vehicle-class <class> --passenger-name <name> \
  [--passenger-phone <phone>] [--passenger-email <email>] --idempotency-key <key>
agenzo-merchant-cli ride get <order-id> --api-key sk_xxx
agenzo-merchant-cli ride cancel <order-id> --api-key sk_xxx --idempotency-key <key>
agenzo-merchant-cli ride list-orders --api-key sk_xxx [--status <status>] [--page <n>] [--page-size <n>]
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--format <json\|table>` | Output format. Defaults to `json`; pass `--format table` for a human-readable table. |
| `--api-key <key>` | API key for runtime requests, sent as the `X-API-Key` header. |
| `--idempotency-key <key>` | Caller-supplied idempotency key for write operations (`ride book`, `ride cancel`). |
| `--yes` | Skip confirmation/interactive prompts (for automation / AI Agents). |

### Output format

All commands emit JSON by default, which is ideal for scripting and AI Agents.
Add `--format table` for a readable summary instead:

```bash
agenzo-merchant-cli ride list-orders --api-key sk_xxx --format table
```

### Idempotency

Write operations (`ride book`, `ride cancel`) require a caller-supplied
`--idempotency-key`. The CLI **never** auto-generates one:

- Without `--yes`, the CLI prompts for the key interactively.
- With `--yes`, a missing key is a hard error (`PARAM_IDEMPOTENCY_KEY_REQUIRED`).

The key must be 1–128 characters from `[A-Za-z0-9_-]` and is sent as the
`Idempotency-Key` header — never in the request body.

## Authentication

Runtime commands (`services`, `ride`) require `--api-key`. The value is sent on
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
