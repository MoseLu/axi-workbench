# Axi Coder Handoff

- Project: `axi-coder`
- Physical path: `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`
- Contract alias: `axi-model-gateway` is a grandfathered provider contract at
  the same path; it is not a second repository.
- Purpose: full development workbench for Mac desktop, hosted browser, model
  routing, CLI orchestration, terminal sessions, agent tasks, and artifact
  review.

## Read order

1. `AGENTS.md`
2. `README.md`
3. `CHANGE.md`
4. `VERIFICATION.md`
5. `docs/project-docs.manifest.json`

## Commands

```bash
pnpm typecheck
pnpm test
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml --offline
cargo test --manifest-path src-tauri/Cargo.toml --offline
```

## Current work

- Keep the completion panel wired to generated workspace evidence.
- Keep the Mac desktop, hosted browser, and mobile companion contracts aligned.
- Keep provider routing and credential references separate from the Axi Coder
  product identity.

## Freshness

The manifest and this handoff are project-owned sources. Refresh verification
evidence after implementation changes; generated workspace snapshots are
mirrors, not replacements for these files.


## Ahead-batch snapshot (2026-09-24)

- Branch: `dev`
- Upstream: `origin/dev`
- Ahead commits: 16
- Per v2.1 PRD §4 batch-separation rule:
  - governance batch: 1
  - docs batch: 9
  - product batch (feat/fix/refactor): 1
  - other: 5
- Next verification gate (project-local): `pnpm --filter @axi/workbench type-check && pnpm --filter @axi/workbench test && pnpm --filter @axi/workbench build`
- Push strategy: owner decides; agent does not auto-push.
