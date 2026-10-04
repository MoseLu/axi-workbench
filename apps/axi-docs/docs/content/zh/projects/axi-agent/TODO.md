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

# Axi Agent Platform — TODO

> Dossier TODO. Tracks what Axi Docs still needs to surface for this project.

## P0

- [ ] Confirm project root `AGENTS.md` / `README.md` still exist and match `WORKSPACE_INDEX.md`.
- [ ] Surface canonical verification commands (read from project `AGENTS.md` or `package.json`).

## P1

- [ ] Capture first-party MCP tool mapping if the project exposes one (e.g. `axi_docs_*` adapters, `workspace-project` consumer).
- [ ] Link to active consumers via `workspace.graph.json` (`workspace-project consumers <id>`).

## P2

- [ ] Add a thumbnail or icon if the project is a Dashboard app.
- [ ] Cross-link to Axi Rules entry (`rules/<family>/AGENTS.md`) when behavior rules reference this project.

## Out of Scope

- Project-internal TODOs live in the project root, not here.
