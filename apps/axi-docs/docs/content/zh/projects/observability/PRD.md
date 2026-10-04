---
id: axi-docs-zh-projects-observability
title: Axi Observability
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Observability
graph-tags: [Projects, foundation]
description: Axi Observability workspace project.
project:
  id: observability
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-observability
  source-section: shared
---

# Axi Observability — PRD Slice

> Axi Docs PRD slice for **Axi Observability**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-OBSERVABILITY-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Observability. |
| Acceptance | `docs/content/{en,zh}/projects/observability/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-OBSERVABILITY-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=observability` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
