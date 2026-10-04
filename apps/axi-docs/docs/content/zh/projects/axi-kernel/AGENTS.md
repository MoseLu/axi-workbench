---
id: axi-docs-zh-projects-axi-kernel
title: Axi Kernel
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Kernel
graph-tags: [Projects, foundation]
description: personal-os-core
project:
  id: axi-kernel
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-kernel
  source-section: shared
---

# Axi Kernel — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Kernel** (workspace path: `/Volumes/code/workspace/foundation/axi-kernel`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-kernel/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/foundation/axi-kernel/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/foundation/axi-kernel/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/foundation/axi-kernel`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
