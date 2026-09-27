---
id: axi-docs-en-projects-axi-docs
title: Axi Docs
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Docs
graph-tags: [Projects, projects]
description: Workspace documentation hub combining a React reader, knowledge-source adapters, knowledge graph, MCP document bus, and generated project dossier mirrors.
project:
  id: axi-docs
  partition: projects
  path: /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs
  source-section: core
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# Axi Docs

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs`.
> Section: core / Partition: `projects/`.

## Summary

Workspace documentation hub combining a React reader, knowledge-source adapters, knowledge graph, MCP document bus, and generated project dossier mirrors.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Docs".
- Project root: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs`
- Project `AGENTS.md`: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
