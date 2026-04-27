# agenzo-token-cli

> ⚠️ **BETA** — This CLI is in closed beta testing. Features may change without notice. Not for production use. Stay tuned! Stay tuned!

Command-line tool for the Agent Payment API.

## Installation

```bash
npm install -g agenzo-token-cli
```

**Requirements**: Node.js 18+

## Quick Start

```bash
# 1. Sign in (auto-registers on first use)
agenzo-token-cli login --email your@email.com

# 2. Create a developer
agenzo-token-cli developers create --developer-name "My Agent" --developer-email agent@example.com

# 3. Create an API Key
agenzo-token-cli keys create --developer-id dev_01KPX... --key-name "Production Key"

# 4. Add a payment method (card) → returns payment-method-id (e.g. pm_01KPX...)
agenzo-token-cli payment-methods add --api-key ak_xxx --email user@example.com

# 5. Create a payment token
# Interactive: prompts for card selection and member ID
agenzo-token-cli payment-tokens create --type vcn --api-key ak_xxx
# Or specify type: network-token / x402
agenzo-token-cli payment-tokens create --type network-token --api-key ak_xxx
agenzo-token-cli payment-tokens create --type x402 --api-key ak_xxx
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Sign in via Magic Link (auto-registers on first use) |
| `logout` | Sign out of current organization |
| `orgs me / update / list / switch` | Organization management |
| `developers create / list / get / update` | Developer management |
| `keys create / list / get / rotate / disable` | API Key management |
| `payment-methods add / list / get / disable` | Payment method management |
| `payment-tokens create / list / get / revoke` | Payment tokens (VCN / Network Token / X402) |
| `config set-host <host>` | Set API host (e.g. for local dev) |
| `config reset-host` | Reset API host to default |
| `config show` | Show current configuration |

## Authentication

- **Control Plane** (`orgs`, `developers`, `keys`): Bearer Token, obtained via `login`
- **Runtime Plane** (`payment-methods`, `payment-tokens`): API Key, via `--key` flag

## Project Structure

```
src/
├── auth/              # Authentication (login/logout + AuthService)
├── orgs/              # Organization management
├── developers/        # Developer management
├── keys/              # API Key management
├── payment-methods/   # Payment methods
├── payment-tokens/    # Payment tokens
├── api/               # HTTP client
├── config/            # Local config & credential management
├── utils/             # Formatting, prompts, error handling
└── types/             # TypeScript type definitions
```

## Development

```bash
npm install        # Install dependencies
npm run dev        # Dev build (watch)
npm test           # Run tests
npm run build      # Production build
```

## License

MIT
