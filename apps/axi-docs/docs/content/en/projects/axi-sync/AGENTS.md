---
id: axi-docs-en-projects-axi-sync
title: Axi Change Sync
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Change Sync
graph-tags: [Projects, foundation]
description: AXI Personal OS Change Sync CLI (PRD-04, Phase 2/3). Reads the live Kernel `Change` stream plus `git log` of registered repositories; rates each change L0-L3 by keyword heuristics; maintains a side-store queue with state machine (detected → queued → analyzing → need-review → accepted / ignored / failed); generates daily reports. Promoted from incubator/change-sync/ on 2026-09-21.
project:
  id: axi-sync
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-sync
  source-section: shared
---

# Axi Change Sync — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Change Sync** (workspace path: `/Volumes/code/workspace/foundation/axi-sync`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-sync/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/foundation/axi-sync/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/foundation/axi-sync/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/foundation/axi-sync`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
