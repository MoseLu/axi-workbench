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


# Axi Agent Platform — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Agent Platform** (workspace path: `/Volumes/code/workspace/projects/axi-agent`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-agent/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/projects/axi-agent/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/projects/axi-agent/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/projects/axi-agent`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
