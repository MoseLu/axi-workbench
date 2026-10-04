---
id: axi-docs-en-projects-pelagic
title: Pelagic Open Water
type: project
status: draft
tags: [Axi Docs, Projects, candidates, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Pelagic Open Water
graph-tags: [Projects, candidates]
description: Pelagic Open Water workspace project.
project:
  id: pelagic
  partition: candidates
  path: /Volumes/code/workspace/candidates/pelagic
  source-section: core
---

# Pelagic Open Water — TDD Slice

> Axi Docs TDD slice for **Pelagic Open Water**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/pelagic/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=pelagic` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/pelagic` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
