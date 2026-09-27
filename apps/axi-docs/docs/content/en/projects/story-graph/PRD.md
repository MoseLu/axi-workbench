---
id: axi-docs-en-projects-story-graph
title: Story Graph
type: project
status: active
tags: [Axi Docs, Projects, products, reference]
created: 2026-08-07
modified: 2026-08-08
graph-title: Story Graph
graph-tags: [Projects, products]
description: Evidence-driven local novel relationship graph workbench with a Python pipeline, SQLite evidence store, and React/Vite viewer.
project:
  id: story-graph
  partition: products
  path: /Volumes/code/workspace/products/story-graph
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# Story Graph — PRD Slice

> Axi Docs PRD slice for **Story Graph**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-STORY-GRAPH-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Story Graph. |
| Acceptance | `docs/content/{en,zh}/projects/story-graph/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-STORY-GRAPH-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=story-graph` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
