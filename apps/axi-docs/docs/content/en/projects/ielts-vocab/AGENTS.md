---
id: axi-docs-en-projects-ielts-vocab
title: IELTS Vocabulary
type: project
status: active
tags: [Axi Docs, Projects, products, reference]
created: 2026-07-22
modified: 2026-08-08
graph-title: IELTS Vocabulary
graph-tags: [Projects, products]
description: Full-stack IELTS vocabulary learning product with web, mobile, shared client packages, gateway, split backend services, speech, and production operations.
project:
  id: ielts-vocab
  partition: products
  path: /Volumes/code/workspace/products/ielts-vocab
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# IELTS Vocabulary — Agent Contract

> This dossier is the Axi Docs agent contract for **IELTS Vocabulary** (workspace path: `/Volumes/code/workspace/products/ielts-vocab`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/ielts-vocab/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/products/ielts-vocab/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/products/ielts-vocab/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/products/ielts-vocab`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
