---
id: axi-docs-en-projects-dbskill
title: dbskill — PRD Slice
type: project
status: active
tags: [Axi Docs, Projects, shared, dbskill]
created: 2026-06-10
modified: 2026-08-08
graph-title: dbskill
graph-tags: [Projects, shared]
description: Axi Docs PRD slice for the dbskill mirror.
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

# dbskill — PRD Slice

> Axi Docs PRD slice for **dbskill**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-DBSKILL-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for dbskill. |
| Acceptance | `docs/content/{en,zh}/projects/dbskill/{README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md, README.zh-CN.md}` exist with valid frontmatter. |
| Source | `docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md` (coverage gap #1). |

## REQ-PROJ-DBSKILL-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `frontmatter.project.path` matches `/Volumes/code/workspace/shared/dbskill`. |
| Source | `WORKSPACE_INDEX.md` (will be referenced once dbskill is added). |

## Non-Goals

- Axi Docs does not own dbskill; it only mirrors two READMEs.
- Axi Docs does not duplicate dbskill's skill packs, knowledge atoms, or knowledge packages.
- Axi Docs does not redistribute dbskill's content outside of attribution-compliant use cases.
