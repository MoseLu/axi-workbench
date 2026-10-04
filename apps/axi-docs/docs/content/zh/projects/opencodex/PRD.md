---
id: axi-docs-zh-projects-opencodex
title: OpenCodex Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: OpenCodex Reference
graph-tags: [Projects, references]
description: OpenCodex Reference workspace project.
project:
  id: opencodex
  partition: references
  path: /Volumes/code/workspace/references/opencodex
  source-section: reference
---

# OpenCodex Reference — PRD Slice

> Axi Docs PRD slice for **OpenCodex Reference**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-OPENCODEX-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for OpenCodex Reference. |
| Acceptance | `docs/content/{en,zh}/projects/opencodex/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-OPENCODEX-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=opencodex` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
