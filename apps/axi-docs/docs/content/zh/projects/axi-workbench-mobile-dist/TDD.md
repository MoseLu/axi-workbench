---
id: axi-docs-zh-projects-axi-workbench-mobile-dist
title: Axi Workbench Mobile Distribution
type: project
status: draft
tags: [Axi Docs, Projects, distributions, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workbench Mobile Distribution
graph-tags: [Projects, distributions]
description: Axi Workbench Mobile Distribution is a standalone monorepo for mobile deployment, including @axi/workbench-mobile app and shared @axi/* packages.
project:
  id: axi-workbench-mobile-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-mobile
  source-section: reference
---

# Axi Workbench Mobile Distribution — TDD Slice

> Axi Docs TDD slice for **Axi Workbench Mobile Distribution**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-workbench-mobile-dist/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-workbench-mobile-dist` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-workbench-mobile-dist` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
