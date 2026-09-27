# Commit Ledger Architecture Decision

**Status**: CL-007 Determined
**Date**: 2026-09-15
**Owner**: axi-workbench

## Source Priority

| Priority | Source | Justification |
|----------|--------|---------------|
| 1 | git | Single source of truth for commit identity (sha), branch, author, timestamp, message |
| 2 | changelog | Curated release metadata, supplements git with semantic versioning and human-written summaries |
| 3 | submit-log | Agent invocation audit trail (future phase) |
| 4 | test-report | Quality gates and coverage data (future phase) |

Git is authoritative. Changelog is additive. Submit-log and test-report are optional enrichment.

## Data Boundary

### Collected

- `repoId`: canonical workspace-relative path (e.g., `workbench/axi-workbench`, `foundation/axi-ui`)
- `commitSha`: full 40-char SHA from git
- `branch`: current branch name at scan time
- `head`: abbreviated HEAD SHA at scan time
- `dirty`: boolean indicating uncommitted changes
- `commits`: integer count of commits in the scan range
- `owner`: project owner (currently `mose`)
- `repoType`: one of `project`, `shared-provider`, `infrastructure`, `tool`, `product`, `reference`

### Excluded

- File diffs and blob contents
- Git object graph traversal
- CI credentials and environment variables
- Direct filesystem access (gateway-only)
- Binary assets and LFS pointers
- Non-git version control systems

## Idempotency Key

```
{repoId}#{commitSha}
```

Format: `<workspace-relative-path>#<40-char-sha>`

Example: `workbench/axi-workbench#6a8671c92822ec1ad401985b7bd89ca86ada462d`

Rationale: repoId uniquely identifies the repository within the workspace; commitSha uniquely identifies the commit within that repository. Combined, they form a globally unique idempotency key that survives cross-workspace migration.

## Control Plane Boundaries

### Forbidden Patterns

- No direct filesystem reads outside Gateway module
- No second Gateway (single entry point only)
- No git operations outside git source module
- No cross-workspace references

### Allowed Patterns

- Gateway receives raw git output, normalizes to schema
- Idempotency check happens before write
- Changelog merge happens after git write (additive only)
- Control plane is stateless; state lives in the ledger

## Schema Alignment

Based on CL-006, the control plane exposes:

- `commit-ledger` as the primary domain package
- `commit-ledger-schema` for type definitions
- 7 control plane source modules: commit-ledger, control-plane, idempotency, pairing, personal-os, server, smoke

## Sync Pipeline (CL-019 follow-up)

The persistence store is the JSONL ledger at
`services/control-plane/.cache/commit-ledger/ledger.jsonl`. Populating it from
the live workspace happens through three optional triggers that all funnel
into the same `runSyncJob` worker so the `/commit-ledger/sync-status/:jobId`
API and observability events stay uniform:

| Trigger | Module | Default | Env override | Why |
|---|---|---|---|---|
| Startup sync | `scheduler.mjs` | enabled | `AXI_COMMIT_LEDGER_SYNC_DISABLED=1` | First read on boot reflects the current workspace without anyone hitting the API |
| Periodic sync | `scheduler.mjs` | every 15 min | `AXI_COMMIT_LEDGER_SYNC_INTERVAL_MS` | Catches commits landed between server restarts |
| `.git/` ref watcher | `fs-watcher.mjs` | disabled | `AXI_COMMIT_LEDGER_FS_WATCHER=enabled` | Sub-minute freshness; opt-in because per-repo `fs.watch` cost scales with worktree count |

`POST /commit-ledger/sync` stays available as a manual out-of-band trigger.

The scheduler (`services/control-plane/src/commit-ledger/scheduler.mjs`):

- Dispatches one `startup` job immediately on construction.
- Arms a `setInterval` at `intervalMs` (clamped to a 1s floor by default;
  tests inject a smaller `minIntervalMs`).
- Skips a tick when a previous scheduler-owned job is still queued or running
  so a slow `git log` never spawns a parallel collector.
- Trims the shared job registry to the last 32 entries to keep the map from
  growing without bound on long uptimes.
- Exposes `runNow({ maxCommits })` for one-off manual kicks that respect the
  same in-flight guard.

Repetitive verification (2026-09-24 run): collector fans out across the 35
loaded repos from `workspace.graph.json` and produces ~6,360 commits; the
startup sync upserts those against the existing ledger, taking it from 874
records / 13 projects to 6,361 records / 36 projects. The two PERSISTENCE-TEST
sentinels and the `seed-1` test commit remain in the ledger by design
(see `docs/commit-ledger-status.md` and the user's note that surface deletion
is not the fix).

## Phase 2 Targets

| Target | Status |
|--------|--------|
| Submit-log integration | Pending |
| Test-report integration | Pending |
| idempotency.mjs enforcement | Pending |
| smoke.mjs coverage | Pending |

## References

- CL-001: Project inventory (42 repos, single owner mose)
- CL-002: Project repo state (10 dirty repos)
- CL-003: Product repo state (5 dirty repos)
- CL-004: Shared/infra/tool repo state (8 repos)
- CL-005: Changelog inventory (14 files across projects)
- CL-006: Control plane structure (12 pages, 9 packages)
