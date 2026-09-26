---
id: axi-docs-en-projects-dbskill
title: dbskill — TDD Slice
type: project
status: active
tags: [Axi Docs, Projects, shared, dbskill]
created: 2026-06-10
modified: 2026-08-08
graph-title: dbskill
graph-tags: [Projects, shared]
description: Axi Docs TDD slice for the dbskill mirror.
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

# dbskill — TDD Slice

> Axi Docs TDD slice for **dbskill**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `docs/content/{en,zh}/projects/dbskill/{README,AGENTS,INDEX,TODO,MILESTONE,PRD,TDD,README.zh-CN}.md` all exist with valid frontmatter.
- The `frontmatter.project.path` matches `/Volumes/code/workspace/shared/dbskill` for both locales.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/dbskill` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → visible in the dossier folder listing.
- Stale project root path → update the dossier frontmatter directly; there is no auto-source.
