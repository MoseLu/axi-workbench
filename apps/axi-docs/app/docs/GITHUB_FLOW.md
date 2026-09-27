# GitHub Flow

## Branch Model

Axi Docs uses a Pull Request-centric GitHub Flow profile:

- `dev`: default integration branch
- `main`: protected production release branch

## Allowed Short-Lived Branches

- `feature/<slug>`
- `fix/<slug>`
- `hotfix/<slug>`
- `docs/<slug>`
- `refactor/<slug>`
- `perf/<slug>`
- `test/<slug>`
- `ci/<slug>`
- `build/<slug>`
- `chore/<slug>`

## Standard Flow

1. Sync from `dev`.
2. Create a short-lived branch.
3. Update tests and docs with the change.
4. Run `pnpm quality:check` and `pnpm verify`.
5. Open a Pull Request into `dev`.
6. Merge after review and green CI.
7. Promote release-ready changes from `dev` into `main`.

## Hotfix Flow

1. Branch from `main` with `hotfix/<slug>`.
2. Keep the scope to the production issue.
3. Open a Pull Request into `main`.
4. Merge or cherry-pick the same fix back into `dev`.

## Local Bootstrap

- run `pnpm git:bootstrap` after cloning or after `git init`
- do not develop directly on `main`
