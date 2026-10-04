---
id: axi-docs-zh-projects-axi-model-gateway
title: Axi Model Gateway
type: project
status: draft
tags: [Axi Docs, Projects, workbench, core]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Model Gateway
graph-tags: [Projects, workbench]
description: Axi Model Gateway is represented as the provider/profile/proxy contract owned inside Axi Coder.
project:
  id: axi-model-gateway
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder
  source-section: core
---

# Axi Model Gateway — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Model Gateway** (workspace path: `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-model-gateway/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
