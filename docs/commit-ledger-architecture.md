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

- `repoId`: canonical workspace-relative path (e.g., `projects/axi-workbench`, `shared/axi-ui`)
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

Example: `projects/axi-workbench#6a8671c92822ec1ad401985b7bd89ca86ada462d`

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
