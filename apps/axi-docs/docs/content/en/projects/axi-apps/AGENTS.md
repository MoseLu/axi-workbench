---
id: axi-docs-en-projects-axi-apps
title: Axi Applications
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Applications
graph-tags: [Projects, foundation]
description: AXI Personal OS Applications CLI (PRD-06, Phase 4). Three pure-reader sub-CLIs on the same live Kernel + downstream CLIs: Share (records shareable inbox items as Kernel Change rows + lists ResourceObject kind=shareable), Aggregate (one JSON payload fusing workbench partitions + inbox status + sync L0-L3 + runtime rule/skill/agent counts), Mobile (read-only JSON subset, size-bound for phone-class clients). Promoted from incubator/applications/ on 2026-09-21.
project:
  id: axi-apps
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-apps
  source-section: shared
---

# Axi Applications — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Applications** (workspace path: `/Volumes/code/workspace/foundation/axi-apps`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-apps/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/foundation/axi-apps/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/foundation/axi-apps/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/foundation/axi-apps`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
