# Quality Gate

## Local Commands

- `pnpm branch:check`
- `pnpm docs:check`
- `pnpm commit:check:last`
- `pnpm commit:lint:range -- --from <sha> --to <sha>`
- `pnpm lint`
- `pnpm test:coverage`
- `pnpm quality:check`
- `pnpm verify`

## Git Hooks

- `commit-msg` runs `commitlint`
- `pre-commit` runs branch and docs checks
- `pre-push` runs governance, lint, tests, and build verification

## CI

- CI validates branch, PR title, and commit ranges
- CI runs lint, tests, and build on both `dev` and `main`
- GitHub branch protection should require `governance` and `quality`

## Current Baseline

- coverage reporting is required through `pnpm test:coverage`
- numeric coverage thresholds can be raised later after the current knowledge graph and intake work stabilizes
