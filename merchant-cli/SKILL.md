# agenzo-merchant-cli — AI Agent Skill

CLI for ordering rides and querying merchant services.

## Command groups

- `config set-host <url> | reset-host | show` — manage the API host (local only).
- `ride quote | book | get <order-id> | cancel <order-id> | list-orders` — ride ordering.
- `services list | get <service-id>` — service registry lookup.

## Global flags

- `--format <json|table>` — output format (default `json`).
- `--yes` — skip confirmation prompts (for automation).
- `--api-key <key>` — API key for runtime requests.

> Write operations require a caller-supplied `--idempotency-key`. The CLI never
> auto-generates one; in `--yes` mode a missing key is a hard error.
