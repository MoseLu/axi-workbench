---
id: axi-docs-zh-projects-sub2api
title: Sub2API Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Sub2API Reference
graph-tags: [Projects, references]
description: Sub2API Reference workspace project.
project:
  id: sub2api
  partition: references
  path: /Volumes/code/workspace/references/sub2api
  source-section: reference
---

# Sub2API Reference — TDD Slice

> Axi Docs TDD slice for **Sub2API Reference**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/sub2api/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=sub2api` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/sub2api` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
