# agenzo-merchant-cli

CLI tool for AI Agents to order rides and query merchant services.

This package provides three command groups:

- `config` — local API host configuration (`set-host`, `reset-host`, `show`)
- `ride` — ride ordering flow (`quote`, `book`, `get`, `cancel`, `list-orders`)
- `services` — service registry lookup (`list`, `get`)

## Development

```bash
npm install
npm run build
npm run lint
```

**Requirements**: Node.js 18+
