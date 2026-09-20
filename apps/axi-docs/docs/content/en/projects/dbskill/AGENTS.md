---
id: axi-docs-en-projects-dbskill
title: dbskill — Agent Contract
type: project
status: active
tags: [Axi Docs, Projects, shared, dbskill]
created: 2026-06-10
modified: 2026-08-08
graph-title: dbskill
graph-tags: [Projects, shared]
description: Agent contract for the dbskill mirror dossier in axi-docs.
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

# dbskill — Agent Contract

> This dossier is the Axi Docs agent contract for **dbskill** (workspace path: `/Volumes/code/workspace/shared/dbskill`).
> It does not replace the project root `README.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/dbskill/README.md` (dossier summary).
3. Project root `README.md` at `/Volumes/code/workspace/shared/dbskill/README.md`.
4. Project root `README.zh-CN.md` at `/Volumes/code/workspace/shared/dbskill/README.zh-CN.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/shared/dbskill`.
- Modifications must be proposed back to the upstream project (`github.com/dontbesilent2025/dbskill`).
- The project is upstream-licensed (CC BY-NC 4.0). Do not redistribute contents from this dossier outside of attribution-compliant use cases.

## Update Cadence

- Re-hand-curate when the upstream README materially changes. There is no automatic trigger; this dossier is intentionally outside `build-projects-index.mjs`.
- Promote to auto-generation only after the project is added to `WORKSPACE_INDEX.md`.
