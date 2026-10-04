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

# Axi Agent Platform

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/agent-cluster/axi-agent`.
> Section: core / Partition: `agent-cluster/`.

## Summary

Axi Agent Platform is the canonical agent runtime/API/MCP/transport/bridge monorepo. Backend (FastAPI + uv + pytest + chroma_db) + frontend (React + built dist) + apps/desktop-glass-ui + infra/codex-remote-bridge + tools/axi-todo all surface green verify paths.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Agent Platform".
- Project root: `/Volumes/code/workspace/agent-cluster/axi-agent`
- Project `AGENTS.md`: `/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/agent-cluster/axi-agent/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
