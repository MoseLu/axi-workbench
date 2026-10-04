---
id: axi-docs-zh-projects-axi-local-registry
title: Axi Local Registry
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Local Registry
graph-tags: [Projects, foundation]
description: Local-only Verdaccio registry for publishing and installing @axi/* runtime packages.
project:
  id: axi-local-registry
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-registry
  source-section: shared
---

# Axi Local Registry — PRD Slice

> Axi Docs PRD slice for **Axi Local Registry**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-LOCAL-REGISTRY-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Local Registry. |
| Acceptance | `docs/content/{en,zh}/projects/axi-local-registry/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-LOCAL-REGISTRY-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-local-registry` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
