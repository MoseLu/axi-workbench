---
id: axi-docs-en-projects-axi-pet-desktop
title: Axi Pet Desktop
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Pet Desktop
graph-tags: [Projects, projects]
description: Virtual-companion desktop client (Tauri + React + Rust + Swift host surfaces) carrying the petshop, vet screen, and shared store component model. Status: 2026-08-03 last commit per workspace handoff; canonical entry is the project root AGENTS.md / CHANGE.md.
project:
  id: axi-pet-desktop
  partition: projects
  path: /Volumes/code/workspace/projects/axi-pet-desktop
  source-section: core
---
## 2026-08-08 Refresh Note

axi-pet-desktop is consumed by agents/operators through the desktop shell. lastVerifiedAt was never recorded; this dossier is the first one to attempt a stamp - date 2026-08-08 - so future agents have a known reference point. Canonical project entry remains AGENTS.md at the project root.


# Axi Pet Desktop — PRD Slice

> Axi Docs PRD slice for **Axi Pet Desktop**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-PET-DESKTOP-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Pet Desktop. |
| Acceptance | `docs/content/{en,zh}/projects/axi-pet-desktop/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-PET-DESKTOP-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-pet-desktop` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
