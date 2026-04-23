# agent-token-admin

> [🇨🇳 中文](./README.md) | 🇬🇧 English

Command-line tool for the Agent Payment API.

## Installation

```bash
npm install -g agent-token-admin
```

**Requirements**: Node.js 18+

## Quick Start

```bash
# 1. Login (auto-registers on first use)
agent-token-admin login --email your@email.com

# 2. Create a developer
agent-token-admin developers create --name "My Agent" --email agent@example.com

# 3. Create an API key
agent-token-admin keys create --developer dev_001 --name "Production Key"

# 4. Add a payment method
agent-token-admin payment-methods add --key ak_xxx --email user@example.com

# 5. Create a VCN payment token
agent-token-admin payment-tokens create --type vcn --key ak_xxx --pm pm_001 --member mem_001 --amount 2500
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Sign in via Magic Link (auto-registers on first use) |
| `logout` | Sign out of the current organization |
| `orgs me / update / list / switch` | Organization management |
| `developers create / list / get / update` | Developer management |
| `keys create / list / get / rotate / disable` | API key management |
| `payment-methods add / list / get / disable` | Payment method management |
| `payment-tokens create / list / get / revoke` | Payment tokens (VCN / Network Token / X402) |

## Authentication Modes

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
├── keys/              # API key management
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
