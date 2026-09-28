# Workspace TDD

## Architecture Assumptions

- Root path: `/Volumes/code/workspace`
- Stack signals: document/config driven
- Top-level entries: `AGENTS.md`, `AGENTS.zh-CN.md`, `README.md`, `CHANGELOG.md`, `INDEX.md`, `WORKSPACE_INDEX.md`, `WORKSPACE_INDEX.zh-CN.md`, `dev-services.config.json`, `docs/`, `ecosystem.config.cjs`, `infra/`, `products/`
- No package scripts detected at root.

## Technical Design

The root docs form a lightweight control plane:

1. `AGENTS.md` defines agent-safe boundaries.
2. `docs/state/PRD.md` defines requirements and non-goals.
3. `docs/state/TDD.md` defines verification strategy.
4. `docs/state/TODO.md` maps requirements to tasks and tests.
5. `docs/state/MILESTONE.md` records delivery evidence.
6. `INDEX.md` maps documents and source-of-truth ownership.

## Verification Commands

- `workspace-project validate`
- `rg -n "TODO|PRD|TDD" docs/state/TODO.md docs/state/MILESTONE.md docs/state/PRD.md docs/state/TDD.md`

Minimum documentation check:

```bash
for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md INDEX.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/PRD.md docs/state/TDD.md docs/state/VERIFICATION.md; do test -f "/Volumes/code/workspace/$f" || exit 1; done
rg -n "REQ-DOC-001|PRD|TDD|Milestone" "/Volumes/code/workspace/docs/state/PRD.md" "/Volumes/code/workspace/docs/state/TDD.md" "/Volumes/code/workspace/docs/state/TODO.md" "/Volumes/code/workspace/docs/state/MILESTONE.md" "/Volumes/code/workspace/INDEX.md"
```

## Risk Cases

- Documentation drifts from package manifests or source layout.
- Agents edit outside `/Volumes/code/workspace` without explicit scope.
- Reference checkouts are mistaken for Axi-owned product surfaces.
- Verification commands become stale after dependency or layout changes.

## Test Strategy

- Treat required docs as contract files.
- Prefer existing project test/build commands when implementation changes occur.
- For doc-only changes, run the minimum documentation check above and inspect diffs for placeholder language.
