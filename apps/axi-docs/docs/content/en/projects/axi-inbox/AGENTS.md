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

# Axi Inbox — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Inbox** (workspace path: `/Volumes/code/workspace/foundation/axi-inbox`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-inbox/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/foundation/axi-inbox/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/foundation/axi-inbox/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/foundation/axi-inbox`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
