---
id: axi-docs-zh-projects-axi-workbench-web-dist
title: Axi Workbench Web Distribution
type: project
status: draft
tags: [Axi Docs, Projects, distributions, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workbench Web Distribution
graph-tags: [Projects, distributions]
description: Axi Workbench Web Distribution is a standalone monorepo for web deployment, wrapping the Axi Workbench UI with Turbo, React, and shared @axi/* packages.
project:
  id: axi-workbench-web-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-web
  source-section: reference
---

# Axi Workbench Web Distribution — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Workbench Web Distribution** (workspace path: `/Volumes/code/workspace/distributions/axi-workbench-web`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-workbench-web-dist/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/distributions/axi-workbench-web/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/distributions/axi-workbench-web/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/distributions/axi-workbench-web`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
