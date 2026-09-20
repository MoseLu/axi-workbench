---
id: axi-docs-en-projects-workspace-dev-services
title: Workspace Dev Services
type: project
status: active
tags: [Axi Docs, Projects, dev-services.config.json, shared]
created: 2026-06-10
modified: 2026-08-08
graph-title: Workspace Dev Services
graph-tags: [Projects, dev-services.config.json]
description: PM2-backed local service profiles, dashboard routing, Feishu alert watcher, and NATAPP ingress target configuration.
project:
  id: workspace-dev-services
  partition: dev-services.config.json
  path: /Volumes/code/workspace/dev-services.config.json
  source-section: shared
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# Workspace Dev Services — PRD Slice

> Axi Docs PRD slice for **Workspace Dev Services**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-WORKSPACE-DEV-SERVICES-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Workspace Dev Services. |
| Acceptance | `docs/content/{en,zh}/projects/workspace-dev-services/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-WORKSPACE-DEV-SERVICES-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=workspace-dev-services` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
