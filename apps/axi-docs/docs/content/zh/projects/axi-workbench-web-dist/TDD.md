---
id: axi-docs-zh-projects-axi-workbench-web-dist
title: Axi Workbench Web Distribution
type: project
status: draft
tags: [Axi Docs, Projects, distributions, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workbench Web Distribution
graph-tags: [Projects, distributions]
description: Axi Workbench Web Distribution is a standalone monorepo for web deployment, wrapping the Axi Workbench UI with Turbo, React, and shared @axi/* packages.
project:
  id: axi-workbench-web-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-web
  source-section: reference
---

# Axi Workbench Web Distribution — TDD Slice

> Axi Docs TDD slice for **Axi Workbench Web Distribution**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-workbench-web-dist/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-workbench-web-dist` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-workbench-web-dist` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
