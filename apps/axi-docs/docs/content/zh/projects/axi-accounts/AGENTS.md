---
id: axi-docs-zh-projects-axi-accounts
title: Axi Accounts Contract
type: project
status: draft
tags: [Axi Docs, Projects, docs, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Accounts Contract
graph-tags: [Projects, docs]
description: workspace-resource
project:
  id: axi-accounts
  partition: docs
  path: /Volumes/code/workspace/docs/axi
  source-section: shared
---

# Axi Accounts Contract — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Accounts Contract** (workspace path: `/Volumes/code/workspace/docs/axi`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-accounts/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/docs/axi/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/docs/axi/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/docs/axi`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
