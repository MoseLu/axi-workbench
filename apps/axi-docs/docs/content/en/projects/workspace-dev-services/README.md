---
id: axi-docs-en-projects-workspace-dev-services
title: Workspace Dev Services
type: project
status: active
tags: [Axi Docs, Projects, dev-services.config.json, shared]
created: 2026-06-10
modified: 2026-08-08
graph-title: Workspace Dev Services
graph-tags: [Projects, dev-services.config.json]
description: PM2-backed local service profiles, dashboard routing, Feishu alert watcher, and NATAPP ingress target configuration.
project:
  id: workspace-dev-services
  partition: dev-services.config.json
  path: /Volumes/code/workspace/dev-services.config.json
  source-section: shared
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# Workspace Dev Services

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/dev-services.config.json`.
> Section: shared / Partition: `dev-services.config.json/`.

## Summary

PM2-backed local service profiles, dashboard routing, Feishu alert watcher, and NATAPP ingress target configuration.

## Stack

JSON, Node.js, PM2, LaunchAgent

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Workspace Dev Services".
- Project root: `/Volumes/code/workspace/dev-services.config.json`
- Project `AGENTS.md`: `/Volumes/code/workspace/dev-services.config.json/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/dev-services.config.json/README.md` (when present).

## Notes

Runtime state lives under `.devsvc`; use the config and wrapper as editable entrypoints.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
