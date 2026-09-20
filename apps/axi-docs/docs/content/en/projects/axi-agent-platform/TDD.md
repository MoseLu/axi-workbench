---
id: axi-docs-en-projects-axi-agent
title: Axi Agent Platform
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Agent Platform
graph-tags: [Projects, projects]
description: Multi-agent collaboration platform combining a FastAPI backend, React dashboard, SubAgent worktree isolation, an MCP model swarm, and the Axi Todo tool. Surface-stable per 2026-08-08 handoff refresh; canonical evidence at the project root.
project:
  id: axi-agent
  partition: projects
  path: /Volumes/code/workspace/projects/axi-agent
  source-section: core
---
## 2026-08-08 Refresh Note

Project root and manifest are stable; canonical PRD/TDD/CHANGELOG lives under docs/state/. LastVerifiedAt trail in the handoff snapshot says 2026-06-18; this dossier is brought forward to match.


# Axi Agent Platform — TDD Slice

> Axi Docs TDD slice for **Axi Agent Platform**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-agent/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-agent` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-agent` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
