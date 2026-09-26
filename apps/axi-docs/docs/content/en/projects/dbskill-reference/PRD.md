---
id: axi-docs-en-projects-dbskill-reference
title: DBSkill Reference
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-07-22
modified: 2026-08-08
graph-title: DBSkill Reference
graph-tags: [Projects, references]
description: Third-party DBA-style skills / scripts collection, used as a reference for shell-style database tooling patterns.
project:
  id: dbskill-reference
  partition: references
  path: /Volumes/code/workspace/references/dbskill
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# DBSkill Reference — PRD Slice

> Axi Docs PRD slice for **DBSkill Reference**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-DBSKILL-REFERENCE-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for DBSkill Reference. |
| Acceptance | `docs/content/{en,zh}/projects/dbskill-reference/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-DBSKILL-REFERENCE-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=dbskill-reference` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
