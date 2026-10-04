---
id: axi-docs-en-projects-axi-workbench-desktop-dist
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

# Axi Workbench Desktop Distribution — TDD Slice

> Axi Docs TDD slice for **Axi Workbench Desktop Distribution**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-workbench-desktop-dist/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-workbench-desktop-dist` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-workbench-desktop-dist` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
