# agenzo-admin-cli

[![npm version](https://img.shields.io/npm/v/agenzo-admin-cli)](https://www.npmjs.com/package/agenzo-admin-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Control-plane CLI for the Agenzo platform — login, organizations, developers, and API keys. Built for humans and AI Agents, with interactive prompts, transparent token refresh, multi-org switching, machine-readable JSON output, and stable exit codes.

[Install](#installation) · [AI Agent Skill](#ai-agent-skill) · [Quick Start](#quick-start) · [Commands](#commands) · [Output](#output-formats) · [Exit Codes](#exit-codes) · [Auth](#authentication) · [Contributing](CONTRIBUTING.md)

> **Scope** — `agenzo-admin-cli` owns the **control plane** (`auth`, `config`, `orgs`, `developers`, `keys`). The **runtime plane** (`payment-methods`, `payment-tokens`) lives in the separate `agenzo-token-cli` binary.

## Why agenzo-admin-cli?

- **Agent-Native Design** — Structured [SKILL.md](SKILL.md) out of the box, plus default-on machine output knobs (`--format json`, stable exit codes) so AI Agents can branch on results without scraping text
- **Noun-Verb Surface** — Predictable `<noun> <verb>` commands (`auth login`, `orgs get`, `keys create`) that are easy to discover and script
- **Interactive & Scriptable** — Smart prompts for humans, or pass every flag for automation
- **Secure by Default** — Bearer tokens never touch stdout; the one-time API key is shown once and kept out of read commands
- **Multi-Developer** — One org, multiple developers, scoped API keys

## Features

| Category | Capabilities |
|----------|-------------|
| 🔐 Auth | Magic Link login, auto-registration, transparent token refresh, multi-org switch |
| 👤 Developers | Create, list, get, update developers under your organization |
| 🔑 API Keys | Create, list, get, rotate, disable keys scoped to each developer |
| 🏢 Orgs | View / update the current org, list signed-in orgs, switch active org |
| ⚙️ Config | Set API host, view config, reset to defaults |
| 📤 Output | Human `table` by default, opt-in `--format json` for Agents (`AGENZO_FORMAT` supported) |
| 🚦 Exit Codes | Stable `0–5` matrix + SCREAMING_SNAKE error envelope on stderr |
| 🔁 Idempotency | `--idempotency-key` forwarded verbatim on every server-write command |

## Installation

```bash
npm install -g agenzo-admin-cli
```

**Requirements**: Node.js 18+

### Version compatibility

The server advertises the minimum required CLI version via the `X-CLI-Min-Version` response header. If your installed CLI is below that minimum, any command refuses to run and exits with code `2`:

```
✗ CLI 1.2.0 is below the required minimum 1.3.0.
ℹ Upgrade: npm install -g agenzo-admin-cli@latest
```

Run the upgrade command and retry. The floor is controlled server-side (`AGENT_PAY_CLI_MIN_VERSION` env var), so raising it does not require a CLI release.

## AI Agent Skill

This CLI ships with a structured [SKILL.md](SKILL.md) that AI Agents can use to understand and operate the control-plane flows. The skill covers:

- The onboarding flow (login → developer → API key)
- All command signatures and parameters
- Output-format and idempotency conventions
- Common errors and exit codes

To use with your AI Agent, include `SKILL.md` in the agent's context or tool definition.

## Quick Start

### For Humans

```bash
# 1. Sign in (auto-registers on first use)
agenzo-admin-cli auth login --email your@email.com

# 2. Create a developer
agenzo-admin-cli developers create --developer-name "My Agent" --developer-email agent@example.com

# 3. Create an API Key (save it — only shown once!)
agenzo-admin-cli keys create --developer-id dev_01KPX... --key-name "Production Key"

# 4. Inspect your organization
agenzo-admin-cli orgs get
```

### For AI Agents

> Read [SKILL.md](SKILL.md) for the complete guide. Key points:

1. Output defaults to human `table`. Opt in to machine output with `--format json` (or set `AGENZO_FORMAT=json`).
2. stdout carries **only** the payload (one JSON value in json mode); all logs, prompts, and spinners go to stderr.
3. Branch on the exit code, not on text — see the [Exit Codes](#exit-codes) matrix.
4. Pass `--idempotency-key` on writes so a retried `create` / `rotate` is safe to repeat.

```bash
# Machine-readable output, payload-only on stdout
agenzo-admin-cli orgs get --format json
AGENZO_FORMAT=json agenzo-admin-cli developers list

# Pipe straight into jq
agenzo-admin-cli config show --format json | jq .api_host

# Safe-retry a write with a caller-supplied idempotency key
agenzo-admin-cli developers create \
  --developer-name "My Agent" --developer-email agent@example.com \
  --idempotency-key dev-create-001 --format json
```

## Commands

18 commands across 5 noun groups:

| Command | Description |
|---------|-------------|
| `auth login` | Sign in via Magic Link (auto-registers on first use) |
| `auth logout` | Sign out of the current organization |
| `config set-host / show / reset-host` | Local API host configuration |
| `orgs get / update / list / switch` | Organization management (`get` replaces the legacy `orgs me`) |
| `developers create / list / get / update` | Developer management |
| `keys create / list / get / rotate / disable` | API Key management |

## Command Reference

### Authentication
```bash
agenzo-admin-cli auth login --email your@email.com   # Sign in / auto-register via Magic Link
agenzo-admin-cli auth login --email your@email.com --idempotency-key login-001
agenzo-admin-cli auth logout                          # Sign out of the current org (local + best-effort)
```

`login` and `logout` are grouped under the `auth` noun (they are **not** top-level commands).

### Organization Management
```bash
agenzo-admin-cli orgs get                              # View current org (replaces the old `orgs me`)
agenzo-admin-cli orgs list                             # List all signed-in orgs (local, host-filtered)
agenzo-admin-cli orgs switch <org_id>                  # Switch active org (local; cross-env guarded)
agenzo-admin-cli orgs update --name "New Org Name" --idempotency-key org-001
agenzo-admin-cli orgs update --email new@example.com   # Update org email (requires verification)
```

### Developer Management
```bash
agenzo-admin-cli developers create --developer-name "My Agent" --developer-email agent@example.com --idempotency-key dev-001
agenzo-admin-cli developers list
agenzo-admin-cli developers get <developer_id>
agenzo-admin-cli developers update <developer_id> --name "New Name" --idempotency-key dev-002
agenzo-admin-cli developers update <developer_id> --email new@example.com
```

### API Key Management
```bash
agenzo-admin-cli keys create --developer-id <dev_id> --key-name "Prod Key" --idempotency-key key-001
agenzo-admin-cli keys list --developer-id <dev_id>
agenzo-admin-cli keys get <key_id>
agenzo-admin-cli keys rotate <key_id> --idempotency-key key-002   # New key value (old one invalidated)
agenzo-admin-cli keys disable <key_id> --idempotency-key key-003  # Permanently disable key
```

The plaintext API key returned by `create` / `rotate` is shown **only once** (on stderr in `table` mode, in the JSON payload in `json` mode). `keys list` / `keys get` return metadata only — never the key value.

### Configuration
```bash
agenzo-admin-cli config set-host http://localhost:8000  # Set API host (e.g. local dev)
agenzo-admin-cli config reset-host                      # Reset to default (https://agent.everonet.com)
agenzo-admin-cli config show                            # Show current config (no API call)
```

## Output Formats

The CLI emits a deterministic output contract so the same command serves humans and Agents.

- **Default `table`** — a human-readable projection of the payload.
- **`--format json`** — opt in to machine output. stdout is exactly one `JSON.parse`-able value (the backend response `data` forwarded verbatim, or a small client-built object for local-only commands).
- **`AGENZO_FORMAT`** — set the format via environment when you cannot pass a flag.
- **Resolution precedence**: `--format` flag → `AGENZO_FORMAT` env → default `table`. Any invalid value falls back to `table`. The resolved value is always `json` or `table`.

> This default of `table` is a deliberate deviation from the platform CLI standard (which defaults to `json`); it preserves the existing human-friendly output while keeping a machine path one flag away.

stdout vs stderr:

| Stream | Content |
|--------|---------|
| **stdout** | The business payload only — one JSON value (`json`) or the rendered table/key-value view (`table`) |
| **stderr** | Everything else — spinners, prompts, hints, `--verbose` logs, the one-time key warning, and error envelopes |

```bash
# stdout stays clean, so this round-trips through jq
agenzo-admin-cli orgs get --format json | jq .

# logs and the error envelope never pollute the JSON on stdout
agenzo-admin-cli developers list --format json > devs.json
```

## Idempotency

Every command that issues a **server-side write** accepts `--idempotency-key <key>`. The CLI forwards the value **verbatim** as the HTTP `Idempotency-Key` header and **never auto-generates** one — the caller supplies it. When the flag is absent, no header is sent.

The flag is accepted only by the seven server-write commands:

| Command | Server write |
|---------|--------------|
| `auth login` | `POST /auth/login` (+ `/auth/register` when new) |
| `orgs update` | `POST /organizations/me/update` |
| `developers create` | `POST /developers/create` |
| `developers update` | `POST /developers/{id}/update` |
| `keys create` | `POST /keys/create` |
| `keys rotate` | `POST /keys/{id}/rotate` |
| `keys disable` | `POST /keys/{id}/disable` |

Local-only writes (`config set-host`, `config reset-host`, `orgs switch`, `auth logout`) and read commands do **not** accept the flag.

> **Backend enforcement pending (BACK-090).** The CLI side is complete today — the flag is accepted and the header is forwarded. Server-side de-duplication for these admin endpoints is not yet implemented, so a retried write is currently honored by the backend but not de-duplicated. When the backend adds the idempotency middleware, no CLI change is needed. Until then, confirm a rotated key is fully retired before rotating again.

## Exit Codes

Branch on the exit code for stable automation:

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Business / parameter error (4xx — validation, not-found, conflict, rate-limited) |
| `2` | Upgrade required (CLI below the server-advertised `X-CLI-Min-Version`) |
| `3` | Authentication failure or invalid key (not signed in, session expired, 401/403) |
| `4` | Network error or backend 5xx |
| `5` | User cancel (Ctrl+C or declining a prompt) |

On any failure the CLI writes a SCREAMING_SNAKE error envelope to **stderr** (never stdout) and exits with the mapped code. In `json` mode:

```json
{ "error": { "code": "AUTH_NOT_SIGNED_IN", "message": "Not signed in. Run `agenzo-admin-cli auth login`.", "http": 401 } }
```

In `table` mode the same failure renders as `✗ <message>` (plus a suggestion line for auth errors). The `http` field is included only when the failure originated from an HTTP call. Error codes use the domain prefixes `AUTH_`, `ORG_`, `KEY_`, `PARAM_`, `RATE_`, `UPSTREAM_`, plus `UPGRADE_REQUIRED`, `USER_CANCELLED`, and `INTERNAL_ERROR`; any unrecognized error maps to `INTERNAL_ERROR`.

## Authentication

All commands operate on the control plane and authenticate with a Bearer token obtained via `auth login`:

| Surface | Commands | Auth Method |
|---------|----------|-------------|
| Control Plane | `orgs`, `developers`, `keys` | Bearer Token (via `auth login`) |
| Local-only | `config`, `orgs list`, `orgs switch`, `auth logout` | No API call — local state only |

`AuthService` injects `Authorization: Bearer <token>` and transparently refreshes the token within 300 seconds of expiry, re-running login automatically when the session has fully expired. Config, credentials, and the key cache are stored under `~/.agenzo-admin-cli/`.

## Project Structure

```
├── SKILL.md               # AI Agent skill definition
├── src/
│   ├── auth/              # auth login / logout + AuthService
│   ├── orgs/              # Organization management (get / update / list / switch)
│   ├── developers/        # Developer management
│   ├── keys/              # API Key management
│   ├── config/            # Local config, credentials, key cache (~/.agenzo-admin-cli)
│   ├── api/               # HTTP client + X-CLI-Min-Version negotiation
│   ├── utils/             # output renderer, exit-code mapper, errors, formatting, prompts
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
