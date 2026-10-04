---
id: axi-docs-en-projects-axi-inbox
title: Axi Inbox
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Inbox
graph-tags: [Projects, foundation]
description: AXI Personal OS Inbox CLI (PRD-03, Phase 2). Collects URLs, images, files, ideas, project-refs into a single inbox; auto-detects kind via URI heuristics; transitions through collected/unread/reviewed/linked/transformed/archived; transforms inbox items into Document / Resource (kind=shareable|kind=inspiration|kind=task). Promoted from incubator/resource-inbox/ on 2026-09-21.
project:
  id: axi-inbox
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-inbox
  source-section: shared
---

# Axi Inbox — PRD Slice

> Axi Docs PRD slice for **Axi Inbox**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-INBOX-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Inbox. |
| Acceptance | `docs/content/{en,zh}/projects/axi-inbox/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-INBOX-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-inbox` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
