---
id: axi-docs-en-projects-observability
title: Axi Observability
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Observability
graph-tags: [Projects, foundation]
description: Axi Observability workspace project.
project:
  id: observability
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-observability
  source-section: shared
---

# Axi Observability — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Observability** (workspace path: `/Volumes/code/workspace/foundation/axi-observability`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/observability/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/foundation/axi-observability/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/foundation/axi-observability/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/foundation/axi-observability`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
