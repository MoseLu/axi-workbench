# Axi Workbench TDD

## Architecture Assumptions

- Root path: `/Volumes/code/workspace/projects/axi-workbench`
- Stack signals: Node/TypeScript, document/config driven
- Top-level entries: `AGENTS.en.md`, `AGENTS.md`, `Makefile`, `README.md`, `README.zh-CN.md`, `SECURITY.md`, `ai/`, `apps/`, `backend/`, `docker-compose.yml`, `docs/`, `infra/`, `package.json`, `packages/`
- Package scripts: pnpm dev, pnpm dev:web, pnpm dev:ui, pnpm dev:desktop, pnpm build, pnpm build:web, pnpm build:ui, pnpm build:schemas

## Technical Design

The root docs form a lightweight control plane:

1. `AGENTS.md` defines agent-safe boundaries.
2. `PRD.md` defines requirements and non-goals.
3. `TDD.md` defines verification strategy.
4. `TODO.md` maps requirements to tasks and tests.
5. `MILESTONE.md` records delivery evidence.
6. `INDEX.md` maps documents and source-of-truth ownership.

## Verification Commands

- `pnpm install`
- `pnpm test`
- `pnpm build`

Minimum documentation check:

```bash
for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md; do test -f "/Volumes/code/workspace/projects/axi-workbench/$f" || exit 1; done
rg -n "REQ-DOC-001|PRD|TDD|Milestone" "/Volumes/code/workspace/projects/axi-workbench/PRD.md" "/Volumes/code/workspace/projects/axi-workbench/TDD.md" "/Volumes/code/workspace/projects/axi-workbench/TODO.md" "/Volumes/code/workspace/projects/axi-workbench/MILESTONE.md" "/Volumes/code/workspace/projects/axi-workbench/INDEX.md"
```

## Risk Cases

- Documentation drifts from package manifests or source layout.
- Agents edit outside `/Volumes/code/workspace/projects/axi-workbench` without explicit scope.
- Reference checkouts are mistaken for Axi-owned product surfaces.
- Verification commands become stale after dependency or layout changes.

## Test Strategy

- Treat required docs as contract files.
- Prefer existing project test/build commands when implementation changes occur.
- For doc-only changes, run the minimum documentation check above and inspect diffs for placeholder language.
