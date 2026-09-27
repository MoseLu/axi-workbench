---
id: axi-docs-en-projects-axi-soul-world
title: Axi Soul World
type: project
status: draft
tags: [Axi Docs, Projects, products, reference]
created: 2026-08-23
modified: 2026-08-23
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: A multi-surface local-first product: core backend in this repo, Axi Mood on Android, and an admin Web (later Mac) that logs in by phone QR scan.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: reference
---

# Axi Soul World — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Soul World** (workspace path: `/Volumes/code/workspace/products/axi-soul-world`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-soul-world/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/products/axi-soul-world/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/products/axi-soul-world/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/products/axi-soul-world`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
