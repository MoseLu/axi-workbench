---
id: axi-docs-en-projects-axi-coder
title: Axi Coder
type: project
status: draft
tags: [Axi Docs, Projects, workbench, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Coder
graph-tags: [Projects, workbench]
description: Axi Coder is the full development workbench surface and consumes the generated workspace project completion snapshot.
project:
  id: axi-coder
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder
  source-section: core
---

# Axi Coder — PRD Slice

> Axi Docs PRD slice for **Axi Coder**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-CODER-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Coder. |
| Acceptance | `docs/content/{en,zh}/projects/axi-coder/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-CODER-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-coder` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
