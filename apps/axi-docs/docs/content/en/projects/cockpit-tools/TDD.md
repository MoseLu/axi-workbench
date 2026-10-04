---
id: axi-docs-en-projects-cockpit-tools
title: Cockpit Tools Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Cockpit Tools Reference
graph-tags: [Projects, references]
description: Cockpit Tools Reference workspace project.
project:
  id: cockpit-tools
  partition: references
  path: /Volumes/code/workspace/references/cockpit-tools
  source-section: reference
---

# Cockpit Tools Reference — TDD Slice

> Axi Docs TDD slice for **Cockpit Tools Reference**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/cockpit-tools/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=cockpit-tools` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/cockpit-tools` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
