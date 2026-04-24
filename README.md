# agenzo-pay

Command-line tool for the Agent Payment API.

## Installation

```bash
npm install -g agenzo-pay
```

**Requirements**: Node.js 18+

## Quick Start

```bash
# 1. Sign in (auto-registers on first use)
agenzo-pay login --email your@email.com

# 2. Create a developer
agenzo-pay developers create --dev-name "My Agent" --dev-email agent@example.com

# 3. Create an API Key
agenzo-pay keys create --developer-id dev_01KPX... --key-name "Production Key"

# 4. Add a payment method (card)
agenzo-pay payment-methods add --api-key ak_xxx --card-email user@example.com

# 5. Create a VCN payment token
agenzo-pay payment-tokens create --type vcn --api-key ak_xxx --payment-method-id pm_01KPX... --member mem_001 --amount 2500
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

## Authentication

- **Control Plane** (`orgs`, `developers`, `keys`): Bearer Token, obtained via `login`
- **Runtime Plane** (`payment-methods`, `payment-tokens`): API Key, via `--key` flag

## Documentation

- [Full Command Reference & Samples](./AGENT_CLI.md)

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
