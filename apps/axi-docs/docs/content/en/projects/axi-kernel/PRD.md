---
id: axi-docs-en-projects-axi-kernel
title: Axi Kernel
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Kernel
graph-tags: [Projects, foundation]
description: personal-os-core
project:
  id: axi-kernel
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-kernel
  source-section: shared
---

# Axi Kernel — PRD Slice

> Axi Docs PRD slice for **Axi Kernel**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-KERNEL-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Kernel. |
| Acceptance | `docs/content/{en,zh}/projects/axi-kernel/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-KERNEL-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-kernel` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
