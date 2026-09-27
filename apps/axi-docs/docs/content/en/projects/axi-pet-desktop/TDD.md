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


# Axi Pet Desktop — TDD Slice

> Axi Docs TDD slice for **Axi Pet Desktop**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-pet-desktop/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-pet-desktop` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-pet-desktop` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
