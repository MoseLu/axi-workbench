# Release Operations

## Standard Release

1. ensure `dev` is green:
   - `pnpm quality:check`
   - `pnpm verify`
2. update release notes and key docs
3. open a Pull Request from `dev` into `main`
4. require green `governance` and `quality`
5. merge into `main`
6. publish deployment and run smoke verification

## Hotfix

1. branch from `main` with `hotfix/<slug>`
2. keep the diff minimal
3. run `pnpm quality:check` and `pnpm verify`
4. merge to `main`
5. merge or cherry-pick the same fix back into `dev`

## Rollback

- prefer a revert PR or documented rollback deployment
- do not push directly to `main`
