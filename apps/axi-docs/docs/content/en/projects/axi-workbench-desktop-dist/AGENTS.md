---
id: axi-docs-en-projects-axi-workbench-desktop-dist
title: Axi Workbench Desktop Distribution
type: project
status: draft
tags: [Axi Docs, Projects, distributions, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workbench Desktop Distribution
graph-tags: [Projects, distributions]
description: Axi Workbench Desktop Distribution is a standalone Tauri 2 desktop app wrapping the Axi Workbench web UI for native macOS experience.
project:
  id: axi-workbench-desktop-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-desktop
  source-section: reference
---

# Axi Workbench Desktop Distribution — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Workbench Desktop Distribution** (workspace path: `/Volumes/code/workspace/distributions/axi-workbench-desktop`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-workbench-desktop-dist/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/distributions/axi-workbench-desktop/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/distributions/axi-workbench-desktop/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/distributions/axi-workbench-desktop`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
