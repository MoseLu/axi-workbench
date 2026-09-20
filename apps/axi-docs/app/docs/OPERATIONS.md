# Operations

## Purpose

This is the entrypoint for repository operations.

## Core Runbooks

- `docs/GITHUB_FLOW.md`
- `docs/BRANCH_PROTECTION.md`
- `docs/COMMIT_CONVENTION.md`
- `docs/RELEASE_OPERATIONS.md`
- `docs/QUALITY_GATE.md`
- `TESTING.md`

## Standard Flows

### Daily Delivery

1. branch from `dev`
2. update tests and docs
3. run `pnpm quality:check`
4. run `pnpm verify`
5. open a Pull Request into `dev`

### Release Promotion

1. confirm `dev` is green
2. review `docs/RELEASE_OPERATIONS.md`
3. open a Pull Request from `dev` into `main`

### Production Hotfix

1. branch from `main` with `hotfix/<slug>`
2. keep the diff minimal
3. merge to `main`, then backport to `dev`

## Minimum Command Set

```bash
pnpm install
pnpm git:bootstrap
pnpm commit
pnpm quality:check
pnpm verify
```
