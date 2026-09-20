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


# Axi Pet Desktop

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/projects/axi-pet-desktop`.
> Section: core / Partition: `projects/`.

## Summary

Independent Electron desktop monorepo extracted from axi-pet on 2026-06-18 (former apps/stage-tamagotchi). Owns the macOS-first desktop-pet app and a self-contained set of Stage/electron/contract packages. Namespace locked to @axi-pet-desktop/* (legacy @proj-airi/* packages migrated 2026-07-17). Remote publication pending owner sign-off (see remote_decision_pending). Lineage: fork of axi-pet, sharing the moeru-ai/airi upstream.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Pet Desktop".
- Project root: `/Volumes/code/workspace/projects/axi-pet-desktop`
- Project `AGENTS.md`: `/Volumes/code/workspace/projects/axi-pet-desktop/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/projects/axi-pet-desktop/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
