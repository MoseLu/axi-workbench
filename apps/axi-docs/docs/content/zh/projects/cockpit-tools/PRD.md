---
id: axi-docs-zh-projects-cockpit-tools
title: Cockpit Tools Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Cockpit Tools Reference
graph-tags: [Projects, references]
description: Cockpit Tools Reference workspace project.
project:
  id: cockpit-tools
  partition: references
  path: /Volumes/code/workspace/references/cockpit-tools
  source-section: reference
---

# Cockpit Tools Reference — PRD Slice

> Axi Docs PRD slice for **Cockpit Tools Reference**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-COCKPIT-TOOLS-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Cockpit Tools Reference. |
| Acceptance | `docs/content/{en,zh}/projects/cockpit-tools/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-COCKPIT-TOOLS-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=cockpit-tools` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
