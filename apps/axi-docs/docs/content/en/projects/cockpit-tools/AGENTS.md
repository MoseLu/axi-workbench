---
id: axi-docs-en-projects-cockpit-tools
title: Cockpit Tools Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Cockpit Tools Reference
graph-tags: [Projects, references]
description: Cockpit Tools Reference workspace project.
project:
  id: cockpit-tools
  partition: references
  path: /Volumes/code/workspace/references/cockpit-tools
  source-section: reference
---

# Cockpit Tools Reference — Agent Contract

> This dossier is the Axi Docs agent contract for **Cockpit Tools Reference** (workspace path: `/Volumes/code/workspace/references/cockpit-tools`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/cockpit-tools/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/references/cockpit-tools/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/references/cockpit-tools/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/references/cockpit-tools`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
