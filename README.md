# agenzo-token-cli

[![npm version](https://img.shields.io/npm/v/agenzo-token-cli)](https://www.npmjs.com/package/agenzo-token-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

> ⚠️ **BETA** — This CLI is in closed beta testing. Features may change without notice.

CLI tool for AI Agents to manage payment tokens — VCN, Network Token, and X402. Built for humans and AI Agents, with interactive prompts, 3DS card binding, and multi-developer API key management.

[Install](#installation) · [AI Agent Skill](#ai-agent-skill) · [Quick Start](#quick-start) · [Commands](#commands) · [Auth](#authentication) · [Contributing](CONTRIBUTING.md)

## Why agenzo-token-cli?

- **Agent-Native Design** — Structured [SKILL.md](SKILL.md) out of the box, AI Agents can operate payment flows with zero extra setup
- **Three Token Types** — VCN (virtual cards), Network Token (cryptogram-based), X402 (on-chain signatures)
- **Interactive & Scriptable** — Smart prompts with card selection UI, or pass all flags for automation
- **Secure by Default** — CVV masked input (or `--cvv` flag for automation), OS-native credential storage, 3DS verification
- **Multi-Developer** — One org, multiple developers, scoped API keys

## Features

| Category | Capabilities |
|----------|-------------|
| 🔐 Auth | Magic Link login, auto-registration, token refresh, multi-org switch |
| 👤 Developers | Create, list, get, update developers under your organization |
| 🔑 API Keys | Create, list, rotate, disable keys scoped to each developer |
| 💳 Payment Methods | Card binding with 3DS, verification polling, `--cvv` flag for automation, duplicate card override |
| 🎫 VCN | Virtual card with spend limit, backed by AgentCard + Evo preauth |
| 🔒 Network Token | Cryptogram via evo-cli, supports Visa & MasterCard (issuer-dependent) |
| ⛓️ X402 | On-chain payment signature for Web3 transactions |
| ⚙️ Config | Set API host, view config, reset to defaults |

## Installation

```bash
npm install -g agenzo-token-cli
```

**Requirements**: Node.js 18+

## AI Agent Skill

This CLI ships with a structured [SKILL.md](SKILL.md) that AI Agents can use to understand and operate all payment flows. The skill covers:

- Complete onboarding flow (login → developer → key → card → token)
- All command signatures and parameters
- Token type compatibility rules
- Common errors and fixes

To use with your AI Agent, include `SKILL.md` in the agent's context or tool definition.

## Quick Start

### For Humans

```bash
# 1. Sign in (auto-registers on first use)
agenzo-token-cli login --email your@email.com

# 2. Create a developer
agenzo-token-cli developers create --developer-name "My Agent" --developer-email agent@example.com

# 3. Create an API Key (save it — only shown once!)
agenzo-token-cli keys create --developer-id dev_01KPX... --key-name "Production Key"

# 4. Bind a card (interactive 3DS verification)
agenzo-token-cli payment-methods add --api-key sk_prod_xxx --email user@example.com

# Or pass all card details for automation (CVV via flag)
agenzo-token-cli payment-methods add --api-key sk_prod_xxx --email user@example.com --card-number 2223001870064586 --expiry 1226 --cvv 935

# 5. Create a payment token (interactive card selection)
agenzo-token-cli payment-tokens create --type vcn --api-key sk_prod_xxx
agenzo-token-cli payment-tokens create --type network-token --api-key sk_prod_xxx
agenzo-token-cli payment-tokens create --type x402 --api-key sk_prod_xxx

# Or specify card directly (matches by last 4 digits, skips selection)
agenzo-token-cli payment-tokens create --type network-token --api-key sk_prod_xxx --card 5204731620064587
```

### For AI Agents

> Read [SKILL.md](SKILL.md) for the complete guide. Key points:

1. All Runtime Plane commands require `--api-key` (the full `sk_prod_...` string)
2. API keys are scoped to a developer — cards bound with Key A are not visible to Key B
3. `payment-tokens create` auto-fetches the card list and prompts for selection
4. Not all cards support Network Token — check `evo_data.network_token` after binding

## Commands

| Command | Description |
|---------|-------------|
| `login` | Sign in via Magic Link (auto-registers on first use) |
| `logout` | Sign out of current organization |
| `orgs me / update / list / switch` | Organization management |
| `developers create / list / get / update` | Developer management |
| `keys create / list / get / rotate / disable` | API Key management |
| `payment-methods add / list / get / disable` | Card binding with 3DS verification |
| `payment-tokens create / list / get / revoke` | Payment tokens (VCN / Network Token / X402) |
| `config set-host / reset-host / show` | API host configuration |

## Command Reference

### Organization Management
```bash
agenzo-token-cli orgs me                              # View current org
agenzo-token-cli orgs list                            # List all signed-in orgs
agenzo-token-cli orgs switch <org_id>                 # Switch active org
agenzo-token-cli orgs update --name "New Org Name"    # Update org name
agenzo-token-cli orgs update --email new@example.com  # Update org email (requires verification)
```

### Developer Management
```bash
agenzo-token-cli developers create --developer-name "My Agent" --developer-email agent@example.com
agenzo-token-cli developers list
agenzo-token-cli developers get <developer_id>
agenzo-token-cli developers update <developer_id> --name "New Name"
agenzo-token-cli developers update <developer_id> --email new@example.com
```

### API Key Management
```bash
agenzo-token-cli keys create --developer-id <dev_id> --key-name "Prod Key"
agenzo-token-cli keys list --developer-id <dev_id>
agenzo-token-cli keys get <key_id>
agenzo-token-cli keys rotate <key_id>     # Generate new key value (old one invalidated)
agenzo-token-cli keys disable <key_id>    # Permanently disable key
```

### Payment Method Management
```bash
agenzo-token-cli payment-methods add --api-key <key>
agenzo-token-cli payment-methods add --api-key <key> --email user@example.com --card-number 2223001870064586 --expiry 1226 --cvv 935
agenzo-token-cli payment-methods list --api-key <key>
agenzo-token-cli payment-methods get <pm_id> --api-key <key>
agenzo-token-cli payment-methods disable <pm_id> --api-key <key>
```

### Payment Token Management
```bash
# Interactive mode (prompts for type, amount, etc.)
agenzo-token-cli payment-tokens create --api-key <key>

# Full-flag mode (for automation / AI Agents)
agenzo-token-cli --yes payment-tokens create --type vcn --api-key <key> --card 2223001870064586 --amount 30
agenzo-token-cli --yes payment-tokens create --type network-token --api-key <key> --card 2223001870064586
agenzo-token-cli --yes payment-tokens create --type x402 --api-key <key> --payment-method-id <pm_id> --pay-to 0xABC... --amount 1000000 --nonce abc123 --network base_sepolia --deadline 1777457396

# Query and revoke
agenzo-token-cli payment-tokens list --api-key <key>
agenzo-token-cli payment-tokens get <ptk_id> --api-key <key>
agenzo-token-cli payment-tokens revoke <ptk_id> --api-key <key>
```

### Configuration
```bash
agenzo-token-cli config set-host http://localhost:8000  # Set API host (local dev)
agenzo-token-cli config reset-host                      # Reset to default
agenzo-token-cli config show                            # Show current config
```

## Authentication

| Plane | Commands | Auth Method |
|-------|----------|-------------|
| Control Plane | `orgs`, `developers`, `keys` | Bearer Token (via `login`) |
| Runtime Plane | `payment-methods`, `payment-tokens` | API Key (`--api-key` flag) |

## Project Structure

```
├── SKILL.md               # AI Agent skill definition
├── src/
│   ├── auth/              # Login/logout + AuthService
│   ├── orgs/              # Organization management
│   ├── developers/        # Developer management
│   ├── keys/              # API Key management
│   ├── payment-methods/   # Card binding + 3DS
│   ├── payment-tokens/    # VCN / Network Token / X402
│   ├── api/               # HTTP client
│   ├── config/            # Local config & credentials
│   ├── utils/             # Formatting, prompts, errors
│   └── types/             # TypeScript type definitions
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
