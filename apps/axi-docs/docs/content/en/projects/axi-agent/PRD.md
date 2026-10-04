---
id: axi-docs-en-projects-axi-agent
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

# Axi Agent Platform — PRD Slice

> Axi Docs PRD slice for **Axi Agent Platform**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-AGENT-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Agent Platform. |
| Acceptance | `docs/content/{en,zh}/projects/axi-agent/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-AGENT-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-agent` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
