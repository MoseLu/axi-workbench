---
id: axi-docs-zh-projects-axi-apps
title: Axi Applications
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Applications
graph-tags: [Projects, foundation]
description: AXI Personal OS Applications CLI (PRD-06, Phase 4). Three pure-reader sub-CLIs on the same live Kernel + downstream CLIs: Share (records shareable inbox items as Kernel Change rows + lists ResourceObject kind=shareable), Aggregate (one JSON payload fusing workbench partitions + inbox status + sync L0-L3 + runtime rule/skill/agent counts), Mobile (read-only JSON subset, size-bound for phone-class clients). Promoted from incubator/applications/ on 2026-09-21.
project:
  id: axi-apps
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-apps
  source-section: shared
---

# Axi Applications — PRD Slice

> Axi Docs PRD slice for **Axi Applications**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-APPS-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Applications. |
| Acceptance | `docs/content/{en,zh}/projects/axi-apps/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-APPS-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-apps` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
