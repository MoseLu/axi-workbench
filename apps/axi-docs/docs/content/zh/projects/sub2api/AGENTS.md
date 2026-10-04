---
id: axi-docs-zh-projects-sub2api
title: Sub2API Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Sub2API Reference
graph-tags: [Projects, references]
description: Sub2API Reference workspace project.
project:
  id: sub2api
  partition: references
  path: /Volumes/code/workspace/references/sub2api
  source-section: reference
---

# Sub2API Reference — Agent Contract

> This dossier is the Axi Docs agent contract for **Sub2API Reference** (workspace path: `/Volumes/code/workspace/references/sub2api`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/sub2api/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/references/sub2api/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/references/sub2api/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/references/sub2api`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
