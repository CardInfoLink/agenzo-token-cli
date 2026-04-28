# Contributing

Thanks for your interest in contributing to agenzo-token-cli!

## Development Setup

```bash
# Clone the project
git clone https://github.com/CardInfoLink/agent-token-cli.git
cd agent-token-cli

# Install dependencies
npm install

# Dev build (watch mode)
npm run dev

# Run tests
npm test

# Production build
npm run build
```

## Project Structure

```
src/
├── auth/              # Authentication (login/logout + AuthService)
├── orgs/              # Organization management
├── developers/        # Developer management
├── keys/              # API Key management
├── payment-methods/   # Payment methods (card binding + 3DS)
├── payment-tokens/    # Payment tokens (VCN / Network Token / X402)
├── api/               # HTTP client
├── config/            # Local config & credential storage
├── utils/             # Formatting, prompts, error handling
└── types/             # TypeScript type definitions
```

Each feature directory maps to a subcommand. For example, to modify `developers create`, edit `src/developers/create.ts`.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add new payment type support
fix: handle timeout in magic link polling
docs: update README examples
refactor: simplify auth token refresh logic
test: add property tests for formatter
```

## Pull Requests

1. Fork the repo and create a branch
2. Make sure `npm run build` and `npm test` pass
3. Submit a PR with a clear description of your changes
