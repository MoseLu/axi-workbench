# Contributing

Axi Docs follows the same repository governance baseline as the Axi scaffold:

- `dev` is the default integration branch
- `main` is the protected production release branch
- all work lands through Pull Requests
- commits and PR titles follow Conventional Commits

## Branch Rules

- create regular work from `dev`
- use short-lived branches such as:
  - `feature/<slug>`
  - `fix/<slug>`
  - `docs/<slug>`
  - `refactor/<slug>`
  - `perf/<slug>`
  - `test/<slug>`
  - `ci/<slug>`
  - `build/<slug>`
  - `chore/<slug>`
- use `hotfix/<slug>` from `main` only for production incidents

## Required Checks

- `pnpm quality:check`
- `pnpm verify`
- green CI on `governance` and `quality`

## Required Reading

- `docs/OPERATIONS.md`
- `docs/GITHUB_FLOW.md`
- `docs/BRANCH_PROTECTION.md`
- `docs/COMMIT_CONVENTION.md`
- `docs/RELEASE_OPERATIONS.md`
- `docs/QUALITY_GATE.md`
