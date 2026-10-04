---
id: axi-docs-en-projects-axi-model-gateway
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

# Axi Model Gateway — TDD Slice

> Axi Docs TDD slice for **Axi Model Gateway**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-model-gateway/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-model-gateway` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-model-gateway` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
