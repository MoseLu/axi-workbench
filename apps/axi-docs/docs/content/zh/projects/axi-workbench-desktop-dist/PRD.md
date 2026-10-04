---
id: axi-docs-zh-projects-axi-workbench-desktop-dist
title: Axi Workbench Desktop Distribution
type: project
status: draft
tags: [Axi Docs, Projects, distributions, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workbench Desktop Distribution
graph-tags: [Projects, distributions]
description: Axi Workbench Desktop Distribution is a standalone Tauri 2 desktop app wrapping the Axi Workbench web UI for native macOS experience.
project:
  id: axi-workbench-desktop-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-desktop
  source-section: reference
---

# Axi Workbench Desktop Distribution — PRD Slice

> Axi Docs PRD slice for **Axi Workbench Desktop Distribution**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-WORKBENCH-DESKTOP-DIST-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Workbench Desktop Distribution. |
| Acceptance | `docs/content/{en,zh}/projects/axi-workbench-desktop-dist/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-WORKBENCH-DESKTOP-DIST-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-workbench-desktop-dist` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
