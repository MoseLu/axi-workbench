---
id: axi-docs-en-projects-axi-pet-desktop
title: Axi Pet Desktop
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Pet Desktop
graph-tags: [Projects, projects]
description: Virtual-companion desktop client (Tauri + React + Rust + Swift host surfaces) carrying the petshop, vet screen, and shared store component model. Status: 2026-08-03 last commit per workspace handoff; canonical entry is the project root AGENTS.md / CHANGE.md.
project:
  id: axi-pet-desktop
  partition: projects
  path: /Volumes/code/workspace/projects/axi-pet-desktop
  source-section: core
---
## 2026-08-08 Refresh Note

axi-pet-desktop is consumed by agents/operators through the desktop shell. lastVerifiedAt was never recorded; this dossier is the first one to attempt a stamp - date 2026-08-08 - so future agents have a known reference point. Canonical project entry remains AGENTS.md at the project root.


# Axi Pet Desktop — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Pet Desktop** (workspace path: `/Volumes/code/workspace/projects/axi-pet-desktop`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-pet-desktop/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/projects/axi-pet-desktop/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/projects/axi-pet-desktop/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/projects/axi-pet-desktop`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
