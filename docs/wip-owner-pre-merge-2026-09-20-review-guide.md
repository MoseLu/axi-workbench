# wip/owner-pre-merge-2026-09-20 — owner review guide

This guide describes what is on `wip/owner-pre-merge-2026-09-20`,
how to triage it, and the three resolution paths (cherry-pick,
split, discard).

## What is on this branch

A single chore commit on top of `32c28dde` (the workbench
baseline after `@epap/schemas-compat` removal):

```
9612e537 chore(workbench): pre-existing owner WIP — preserved on wip/owner-pre-merge-2026-09-20
```

The commit captures the 199 files that were sitting on
`chore/merge-baseline-projects-2026-09-20` BEFORE the
WFB-BASE-MERGE landed. It is a tree-shape snapshot, not a
feature commit.

## File breakdown

| Bucket | Files | Notes |
|---|---|---|
| `.claude/clog-run/*.json` | 5 | Agent runtime artifacts; safe to discard |
| `.commitlintrc.json` + `commitlint.config.js` | 2 | Duplicate lint config; keep one |
| `.gitmessage` | 1 | Commit template; keep if you use it |
| `.github/workflows/axi-ci.yml` | 1 | Review for CI changes you actually want |
| `AGENTS.md` / `AGENTS.en.md` / `README.md` / `README.zh-CN.md` / `PRD.md` | 5 | Workbench project docs |
| `apps/app-search-system/backend/*.py` + `scripts/build_chroma.py` | 5 | app-search backend |
| `apps/axi-coder/{src,docs,public}/**` | 6 | axi-coder surfaces |
| `apps/axi-docs/app/project_manager.py` | 1 | axi-docs entry |
| `apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md` | 1 | devsvc doc |
| `apps/workbench-mobile/{android,src}/**` | 2 | mobile Kotlin + test |
| `apps/workbench-shared/{package.json, src/index.ts}` | 2 | shared |
| `apps/workbench/{src, package.json}` | 30+ | workbench main |
| `packages/api-client/{package.json, src/client.ts}` | 2 | api-client (now `@axi/api-client`) |
| `packages/types/package.json` | 1 | types (now `@axi/types`) |
| `packages/utils/{package.json, test/utils.test.ts}` | 2 | utils |
| `packages/workbench-foundation/package.json` | 1 | foundation |
| `packages/ui/**` (deleted) | 50+ | Legacy `packages/ui/` cleanup (already merged into shared/axi-ui) |
| `pnpm-lock.yaml` | 1 (152 lines) | Resolves the rename + legacy cleanup |
| `services/api-gateway/cmd/gateway/main.go` | 1 | Go service |
| `services/communication-gateway/test/envelopes.test.mjs` | 1 | communication gateway |
| `services/control-plane/{src, test}/**` | 2 | commit-ledger |
| `services/resource-gateway/{src/server.ts, src/logging/traceparent.ts}` | 2 | resource gateway + new traceparent |
| `tsconfig.base.json` | 1 | TS config |
| `scripts/verify-ci-contracts.{mjs,test.mjs}` | 2 | Now merged into chore as commit 4fce2633 |

## Three resolution paths

### Path A: split into thematic chore commits (recommended)

Run from `wip/owner-pre-merge-2026-09-20`:

```bash
git checkout wip/owner-pre-merge-2026-09-20
git reset --soft 32c28dde          # uncommit, keep staged
git reset                             # unstage everything

# Now manually stage by bucket and commit each as a themed chore.
# Suggested split (each is one or two-line Lore-trailer commit):

git add .claude/clog-run/ scripts/verify-ci-contracts.* scripts/test-loader.* commitlint.config.js .commitlintrc.json .gitmessage
git commit -m "chore(ci): import scripts/verify-ci-contracts.mjs and CI helper scripts

[Standard Lore trailer]"

git add packages/api-client/ packages/types/ packages/utils/ packages/workbench-foundation/ packages/ui/
git commit -m "chore(packages): rename @epap/{api-client,types,utils} -> @axi/* and drop legacy packages/ui

[Standard Lore trailer]"

git add apps/workbench/src/legal-ssr-entry.test.tsx apps/workbench/src/pages/admin/me/DesktopSettingsPage.test.tsx apps/workbench/src/legal-ssr-entry.tsx
git commit -m "test(workbench): migrate react-router 7 SSR tests to data-router

[Standard Lore trailer]"
# Note: legal-ssr-entry.tsx and the two tests are already
# committed on dev under commit 9bab6c9f. Pick one of:
#   (1) drop these files from the split (conflict-resolved), or
#   (2) let the wip branch rebase onto dev and skip them.

git add apps/axi-coder/ apps/devsvc-dashboard/docs/ apps/axi-docs/app/project_manager.py apps/app-search-system/
git commit -m "chore(apps): surface project docs + app-search backend + devsvc docs

[Standard Lore trailer]"

git add apps/workbench/src/pages/ apps/workbench/src/config/roleConfig.ts apps/workbench/src/pages/admin/tenantMemberCrud.ts apps/workbench/src/lib/ apps/workbench/vite.config.ts apps/workbench-shared/
git commit -m "feat(workbench): <describe what these changes actually do>

[Standard Lore trailer]"
# This is the one bucket that requires owner judgment —
# many of these are large edits to production pages.

git add services/ services/api-gateway/ services/control-plane/
git commit -m "fix(services): <describe the gateway + control-plane + api-gateway changes>

[Standard Lore trailer]"

git add apps/workbench-mobile/ tsconfig.base.json pnpm-lock.yaml
git commit -m "chore(mobile): kotlin workspace + tsconfig + lockfile

[Standard Lore trailer]"

# Verify
pnpm verify:ci
pnpm --filter @axi/workbench test
workspace-project handoff-check axi-workbench
```

If any sub-bucket is actually merge-conflicting with dev (because
9bab6c9f + b13efa5b + fdc9586b already moved the same files),
the simpler approach is to delete those paths from the wip
commit before splitting — see "Conflict-prone paths" below.

### Path B: discard the WIP entirely

If the owner decides none of the WIP belongs in the merged
baseline:

```bash
git branch -D wip/owner-pre-merge-2026-09-20
```

Before deleting, verify there are no remotes:

```bash
git push origin --delete wip/owner-pre-merge-2026-09-20 2>/dev/null
git remote prune origin
```

### Path C: ship as a single follow-up PR

```bash
git push -u origin wip/owner-pre-merge-2026-09-20
# Open PR: chore(workbench): triage pre-existing owner WIP for post-merge
```

The PR title should reflect whether the WIP is **accepted as-is**
(single follow-up merge to dev after WFB-BASE-MERGE stabilises),
or **split into multiple PRs** per logical concern.

## Conflict-prone paths (cross-check against dev)

The following paths were already modified on `dev` in commits
`9bab6c9f` and `b13efa5b`. If the wip branch still touches them,
the split or rebase will conflict:

- `apps/workbench/src/legal-ssr-entry.tsx`
- `apps/workbench/src/legal-ssr-entry.test.tsx`
- `apps/workbench/src/pages/admin/me/DesktopSettingsPage.test.tsx`
- `packages/api-client/**` (rename to `@axi/api-client`)
- `packages/types/**` (rename to `@axi/types`)
- `packages/utils/**` (rename to `@axi/utils`)
- `packages/ui/**` (deleted on dev in commit 2a11d9d5)
- `scripts/verify-ci-contracts.mjs` (cherry-picked to dev in 4fce2633)

When splitting into thematic commits, prefer to drop these paths
from the wip branch entirely (since they are already in dev)
and split the remaining wip content as Path A describes.

## Suggested order

1. Run `git checkout wip/owner-pre-merge-2026-09-20 && git reset
   --soft 32c28dde` to uncommit the WIP and start fresh.
2. Diff each file bucket against dev to identify what is
   already in dev and what is genuinely new.
3. Path A (split) is the recommended default. Re-create each
   thematic commit, dropping files that conflict with dev.
4. Run the verification matrix per commit; merge into dev in
   order.
