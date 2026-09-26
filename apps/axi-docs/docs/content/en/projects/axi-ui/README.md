---
id: axi-docs-en-projects-axi-ui
title: Axi UI
type: project
status: active
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi UI
graph-tags: [Projects, shared]
description: Axi shared UI runtime layer (tokens + react + react-antd + react-addons). Drives the Axi Dashboard shell used by workbench, axiom-agent-platform, axiom-pet-desktop, axiom-pet, and axiom-image-preview. Refreshed against the 2026-08 workbench dual-app posture.
project:
  id: axi-ui
  partition: shared
  path: /Volumes/code/workspace/shared/axi-ui
  source-section: shared
---
## 2026-08-08 Refresh Note

axi-ui sits underneath all Axi-om dashboards and the workbench shell. Two follow-up edges in the 2026-08 batch: a brand-new tools/axi-app-cli import dependency split, and the workbench @axi/shell upgrade to 0.3.0 / AxiTabActionMenu. This mirror notes those changes; canonical changelog is at the package root.


# Axi UI

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/shared/axi-ui`.
> Section: shared / Partition: `shared/`.

## Summary

Canonical Axi Black Gold design tokens and theme runtime, plus shared React primitives, shell, settings, CRUD, widgets, addons, and Vite tooling published as @axi packages.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi UI".
- Project root: `/Volumes/code/workspace/shared/axi-ui`
- Project `AGENTS.md`: `/Volumes/code/workspace/shared/axi-ui/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/shared/axi-ui/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
