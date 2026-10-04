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

# Axi Agent Platform — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Agent Platform** (workspace path: `/Volumes/code/workspace/agent-cluster/axi-agent`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-agent/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/agent-cluster/axi-agent/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/agent-cluster/axi-agent`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
