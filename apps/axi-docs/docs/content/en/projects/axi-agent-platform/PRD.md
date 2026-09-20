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


# Axi Agent Platform — PRD Slice

> Axi Docs PRD slice for **Axi Agent Platform**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-AGENT-PLATFORM-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Agent Platform. |
| Acceptance | `docs/content/{en,zh}/projects/axi-agent/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-AGENT-PLATFORM-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-agent` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
