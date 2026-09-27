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


# Axi UI — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi UI** (workspace path: `/Volumes/code/workspace/shared/axi-ui`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-ui/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/shared/axi-ui/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/shared/axi-ui/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/shared/axi-ui`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
