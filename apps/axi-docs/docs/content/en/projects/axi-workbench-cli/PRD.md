---
id: axi-docs-en-projects-axi-workbench-cli
title: AXI Personal OS Workbench CLI
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: AXI Personal OS Workbench CLI
graph-tags: [Projects, foundation]
description: personal-os-runtime
project:
  id: axi-workbench-cli
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-workbench-cli
  source-section: shared
---

# AXI Personal OS Workbench CLI — PRD Slice

> Axi Docs PRD slice for **AXI Personal OS Workbench CLI**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-WORKBENCH-CLI-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for AXI Personal OS Workbench CLI. |
| Acceptance | `docs/content/{en,zh}/projects/axi-workbench-cli/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-WORKBENCH-CLI-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-workbench-cli` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
