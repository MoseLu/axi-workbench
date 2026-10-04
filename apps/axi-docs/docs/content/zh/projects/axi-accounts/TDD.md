---
id: axi-docs-zh-projects-axi-accounts
title: Axi Accounts Contract
type: project
status: draft
tags: [Axi Docs, Projects, docs, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Accounts Contract
graph-tags: [Projects, docs]
description: workspace-resource
project:
  id: axi-accounts
  partition: docs
  path: /Volumes/code/workspace/docs/axi
  source-section: shared
---

# Axi Accounts Contract — TDD Slice

> Axi Docs TDD slice for **Axi Accounts Contract**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-accounts/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-accounts` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-accounts` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
