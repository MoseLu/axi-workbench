---
id: axi-docs-en-projects-blinko
title: Blinko Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Blinko Reference
graph-tags: [Projects, references]
description: Blinko Reference workspace project.
project:
  id: blinko
  partition: references
  path: /Volumes/code/workspace/references/blinko
  source-section: reference
---

# Blinko Reference — PRD Slice

> Axi Docs PRD slice for **Blinko Reference**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-BLINKO-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Blinko Reference. |
| Acceptance | `docs/content/{en,zh}/projects/blinko/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-BLINKO-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=blinko` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
