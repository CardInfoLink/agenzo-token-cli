# Agent Token CLI Skill

You are a payment integration assistant. Help users operate the `agenzo-token-cli` command-line tool to manage developers, API keys, payment methods, and payment tokens.

## Prerequisites

- Node.js 18+
- CLI installed: `npm install -g agenzo-token-cli`
- Backend API: `https://agent.everonet.com` (default, configurable via `config set-host`)

## Authentication Model

Two authentication planes:

| Plane | Commands | Auth Method |
|-------|----------|-------------|
| Control Plane | `orgs`, `developers`, `keys` | Bearer Token (via `login`) |
| Runtime Plane | `payment-methods`, `payment-tokens` | API Key (`--api-key` flag) |

## Complete Onboarding Flow

Must follow this order. Each step depends on the previous one.

```
login → developers create → keys create → payment-methods add → payment-tokens create
```

### Step 1: Login

```bash
agenzo-token-cli login --email user@example.com
```

- First-time users are auto-registered (prompts for org name)
- Sends a magic link to the email
- CLI polls until the link is clicked (up to 10 minutes)
- Credentials are stored locally in `~/.agenzo-token-cli/`

### Step 2: Create Developer

```bash
agenzo-token-cli developers create --developer-name "My Agent" --developer-email agent@example.com
```

- Returns `developer_id` (e.g. `dev_01KPX...`)
- One org can have multiple developers
- Same email can only create one developer per org

### Step 3: Create API Key

```bash
agenzo-token-cli keys create --developer-id dev_01KPX... --key-name "Production Key"
```

- Returns the full API key (only shown once, save it!)
- Key format: `sk_prod_...`
- Used for all Runtime Plane operations

### Step 4: Add Payment Method (Card Binding)

```bash
agenzo-token-cli payment-methods add --api-key sk_prod_xxx --email user@example.com
```

- Interactive: prompts for card number, expiry (MMYY), CVV
- Initiates 3DS verification (opens browser URL)
- CLI polls verification status automatically
- On success, card becomes ACTIVE with a `pm_xxx` ID
- Duplicate cards (same first6 + last4) are overwritten, not rejected

### Step 5: Create Payment Token

All parameters are optional — supports full-flag mode (for scripts/AI Agents) and interactive mode (for humans).

```bash
# Full-flag mode (no prompts)
agenzo-token-cli payment-tokens create --type network-token --api-key sk_prod_xxx --card 5204731620064587 --member mem_001

# Interactive mode (prompts for everything)
agenzo-token-cli payment-tokens create --type vcn

# Mixed mode (some flags, some prompts)
agenzo-token-cli payment-tokens create --type vcn --api-key sk_prod_xxx --amount 30
```

Card resolution priority:
1. `--payment-method-id pm_xxx` → use directly (no API call)
2. `--card 5204731620064587` → fetch card list, match by last 4 digits
3. Only 1 active card → auto-select (no prompt)
4. Multiple cards → interactive selection

Available flags:

| Flag | Description | Required for |
|------|-------------|-------------|
| `--api-key <key>` | API Key (`sk_prod_...`) | All types |
| `--type <type>` | `vcn`, `network-token`, or `x402` (default: `vcn`) | All types |
| `--card <number>` | Card number (matches by last 4 digits) | Optional |
| `--payment-method-id <id>` | Payment method ID (skips card lookup) | Optional |
| `--member <id>` | Member ID | All types |
| `--amount <amount>` | Amount in USD for VCN (0.01-500.00) | VCN |
| `--currency <code>` | Currency code (default: USD) | VCN |
| `--pay-to <address>` | Recipient address | X402 |
| `--nonce <nonce>` | Nonce value | X402 |
| `--network <network>` | Chain network (e.g. `base`) | X402 |
| `--deadline <timestamp>` | Unix timestamp deadline | X402 |
| `--external-tx-id <id>` | External transaction ID (auto-generated if omitted) | Optional |

### Pre-authorization Confirmation

VCN and X402 involve pre-authorization (fund freeze). The CLI will:
- Show the frozen amount (amount + 5% service fee)
- Ask for confirmation: `Proceed with pre-authorization? (Y/n)`
- Capture will also include 5% service fee

To skip confirmation (for automation/AI Agents), use the global `--yes` flag:
```bash
agenzo-token-cli --yes payment-tokens create --type vcn --api-key sk_prod_xxx --card 520473... --member mem_001 --amount 30
```

Network Token does not involve pre-authorization, so no confirmation is needed.

## Token Types

| Type | Description | Card Requirement |
|------|-------------|-----------------|
| `vcn` | Virtual card with spend limit | Any ACTIVE card (requires successful Evo preauth) |
| `network-token` | Cryptogram for card-present payments | Card must support Network Token (Evo returned networkToken data during binding) |
| `x402` | On-chain payment signature | Any ACTIVE card |

### Network Token Compatibility

Not all cards support Network Token. Support depends on the issuer and card network, not the brand (Visa/MasterCard).

Cards without NT support will return:
```
This card does not support Network Token.
```

How to check: after card binding, the card's `evo_data.network_token` field will have a value if supported, or be empty if not.

## Other Commands

### Organization Management
```bash
agenzo-token-cli orgs me          # View current org
agenzo-token-cli orgs list        # List all orgs
agenzo-token-cli orgs switch      # Switch active org
```

### Developer Management
```bash
agenzo-token-cli developers list                    # List developers
agenzo-token-cli developers get --developer-id dev_xxx  # Get developer details
```

### API Key Management
```bash
agenzo-token-cli keys list                          # List keys
agenzo-token-cli keys rotate --key-id key_xxx       # Rotate key
agenzo-token-cli keys disable --key-id key_xxx      # Disable key
```

### Payment Method Management
```bash
agenzo-token-cli payment-methods list --api-key sk_prod_xxx
agenzo-token-cli payment-methods get --api-key sk_prod_xxx --payment-method-id pm_xxx
agenzo-token-cli payment-methods disable --api-key sk_prod_xxx --payment-method-id pm_xxx
```

### Payment Token Management
```bash
agenzo-token-cli payment-tokens list --api-key sk_prod_xxx
agenzo-token-cli payment-tokens get --api-key sk_prod_xxx --payment-token-id ptk_xxx
agenzo-token-cli payment-tokens revoke --api-key sk_prod_xxx --payment-token-id ptk_xxx
```

### Configuration
```bash
agenzo-token-cli config set-host https://agent.everonet.com  # Set API host
agenzo-token-cli config reset-host                            # Reset to default
agenzo-token-cli config show                                  # Show current config
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `No active payment methods found` | API key belongs to a different developer than the one that bound the card | Use the correct API key |
| `This card does not support Network Token` | Card does not support Network Token | Bind a card that supports NT |
| `Evo preauth failed` | Evo PSP or issuer rejected the preauth | Try a different card or retry later |
| `email: value is not a valid email address` | Invalid email format | Check email format |
| `Duplicate key error` | Developer with same email already exists in this org | Use `developers list` to find existing developer |
| `Internal Server Error` | Unhandled backend exception | Check backend logs for details |
| `Connection failed` | Backend not running or wrong host | Confirm backend is up, check `config show` for API host |

## Important Notes

- **API key scope**: API keys are bound to a specific developer. Cards bound with Key A are NOT visible to Key B.
- **API key value**: The `--api-key` flag takes the full key string (e.g. `sk_prod_abc123...`), not the key ID.
- **Interactive prompts**: All prompts can be skipped by providing the corresponding flag (e.g. `--payment-method-id pm_xxx`).
- **One-time tokens**: Payment tokens are single-use. Create a new one for each transaction.
- **Duplicate binding**: Binding the same card (same first6 + last4) under the same developer overwrites the old record.
- **API path prefix**: All Agent Pay API paths are prefixed with `/api/v3/agent-pay/`, handled internally by the CLI.
