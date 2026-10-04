---
id: axi-docs-en-projects-axi-coder
title: Axi Coder
type: project
status: draft
tags: [Axi Docs, Projects, workbench, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Coder
graph-tags: [Projects, workbench]
description: Axi Coder is the full development workbench surface and consumes the generated workspace project completion snapshot.
project:
  id: axi-coder
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder
  source-section: core
---

# Axi Coder — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Coder** (workspace path: `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-coder/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
