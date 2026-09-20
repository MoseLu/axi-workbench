---
id: axi-docs-en-projects-workspace-relationship-graph
title: Workspace Relationship Graph
type: project
status: active
tags: [Axi Docs, Projects, workspace.graph.json, shared]
created: 2026-06-10
modified: 2026-08-08
graph-title: Workspace Relationship Graph
graph-tags: [Projects, workspace.graph.json]
description: Machine-readable graph of project providers, consumers, contracts, startup profiles, health checks, and verification commands.
project:
  id: workspace-relationship-graph
  partition: workspace.graph.json
  path: /Volumes/code/workspace/workspace.graph.json
  source-section: shared
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# Workspace Relationship Graph — PRD Slice

> Axi Docs PRD slice for **Workspace Relationship Graph**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-WORKSPACE-RELATIONSHIP-GRAPH-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Workspace Relationship Graph. |
| Acceptance | `docs/content/{en,zh}/projects/workspace-relationship-graph/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-WORKSPACE-RELATIONSHIP-GRAPH-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=workspace-relationship-graph` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
