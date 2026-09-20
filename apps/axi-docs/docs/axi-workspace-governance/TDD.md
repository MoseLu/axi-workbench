# Axi Workspace Governance TDD

## Architecture Assumptions

- Root path: `/Volumes/code/workspace/infra/axi-workspace-governance`
- Stack signals: Node/TypeScript, document/config driven
- Top-level entries: `CHANGELOG.md`, `CODEOWNERS`, `CleanNulNull.bat`, `README.md`, `README.zh-CN.md`, `SECURITY.md`, `SECURITY.zh-CN.md`, `agent/`, `contracts/`, `docs/`, `infra/`, `package.json`, `projects/`, `references/`
- Package scripts: pnpm workspace:docs:sync, pnpm workspace:registry:sync, pnpm workspace:audit, pnpm workflow:baseline, pnpm workflow:audit, pnpm workflow:branches, pnpm resource:verify, pnpm completion:test

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
for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md; do test -f "/Volumes/code/workspace/infra/axi-workspace-governance/$f" || exit 1; done
rg -n "REQ-DOC-001|PRD|TDD|Milestone" "/Volumes/code/workspace/infra/axi-workspace-governance/PRD.md" "/Volumes/code/workspace/infra/axi-workspace-governance/TDD.md" "/Volumes/code/workspace/infra/axi-workspace-governance/TODO.md" "/Volumes/code/workspace/infra/axi-workspace-governance/MILESTONE.md" "/Volumes/code/workspace/infra/axi-workspace-governance/INDEX.md"
```

## Risk Cases

- Documentation drifts from package manifests or source layout.
- Agents edit outside `/Volumes/code/workspace/infra/axi-workspace-governance` without explicit scope.
- Reference checkouts are mistaken for Axi-owned product surfaces.
- Verification commands become stale after dependency or layout changes.

## Test Strategy

- Treat required docs as contract files.
- Prefer existing project test/build commands when implementation changes occur.
- For doc-only changes, run the minimum documentation check above and inspect diffs for placeholder language.
