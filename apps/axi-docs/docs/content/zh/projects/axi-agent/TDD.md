---
id: axi-docs-zh-projects-axi-agent
title: Axi Agent Platform
type: project
status: draft
tags: [Axi Docs, Projects, agent-cluster, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Agent Platform
graph-tags: [Projects, agent-cluster]
description: Axi Agent Platform is the canonical agent runtime/API/MCP/transport/bridge monorepo. Backend (FastAPI + uv + pytest + chroma_db) + frontend (React + built dist) + apps/desktop-glass-ui + infra/codex-remote-bridge + tools/axi-todo all surface green verify paths.
project:
  id: axi-agent
  partition: agent-cluster
  path: /Volumes/code/workspace/agent-cluster/axi-agent
  source-section: core
---

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
