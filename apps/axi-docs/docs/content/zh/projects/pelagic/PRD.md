---
id: axi-docs-zh-projects-pelagic
title: Pelagic Open Water
type: project
status: draft
tags: [Axi Docs, Projects, candidates, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Pelagic Open Water
graph-tags: [Projects, candidates]
description: Pelagic Open Water workspace project.
project:
  id: pelagic
  partition: candidates
  path: /Volumes/code/workspace/candidates/pelagic
  source-section: core
---

# Pelagic Open Water — PRD Slice

> Axi Docs PRD slice for **Pelagic Open Water**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-PELAGIC-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Pelagic Open Water. |
| Acceptance | `docs/content/{en,zh}/projects/pelagic/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-PELAGIC-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=pelagic` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
