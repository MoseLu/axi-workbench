---
id: axi-docs-zh-projects-axi-model-gateway
title: Axi Model Gateway
type: project
status: draft
tags: [Axi Docs, Projects, workbench, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Model Gateway
graph-tags: [Projects, workbench]
description: Axi Model Gateway is represented as the provider/profile/proxy contract owned inside Axi Coder.
project:
  id: axi-model-gateway
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder
  source-section: core
---

# Axi Model Gateway — PRD Slice

> Axi Docs PRD slice for **Axi Model Gateway**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-MODEL-GATEWAY-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Model Gateway. |
| Acceptance | `docs/content/{en,zh}/projects/axi-model-gateway/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-MODEL-GATEWAY-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-model-gateway` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
