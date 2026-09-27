---
id: axi-docs-en-projects-dbskill
title: dbskill — TODO
type: project
status: active
tags: [Axi Docs, Projects, shared, dbskill]
created: 2026-06-10
modified: 2026-08-08
graph-title: dbskill
graph-tags: [Projects, shared]
description: Dossier TODO for the dbskill mirror.
project:
  id: dbskill
  partition: shared
  path: /Volumes/code/workspace/shared/dbskill
  source-section: shared
  mirror-strategy: hand-curated
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# dbskill — TODO

> Dossier TODO. Tracks what Axi Docs still needs to surface for this project.

## P0

- [ ] Confirm `dbskill` has a stable upstream path under `shared/` (it does: `/Volumes/code/workspace/shared/dbskill`).
- [x] Hand-curate 4 piece mirror: `README.md`, `AGENTS.md`, `INDEX.md`, `README.zh-CN.md`.

## P1

- [ ] Surface the upstream `LICENSE` (CC BY-NC 4.0) in the dossier `AGENTS.md` boundary section (already referenced).
- [ ] Decide whether to also mirror `VERSION` (currently `2.14.2` per upstream `README.md`).

## P2

- [ ] Promote from `status: draft` to `status: published` once content is reviewed.

## Out of Scope

- Skill packs and knowledge base are not mirrored; consumers should install from upstream.
