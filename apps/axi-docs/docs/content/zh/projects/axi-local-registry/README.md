---
id: axi-docs-zh-projects-axi-local-registry
title: Axi Local Registry
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Local Registry
graph-tags: [Projects, foundation]
description: Local-only Verdaccio registry for publishing and installing @axi/* runtime packages.
project:
  id: axi-local-registry
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-registry
  source-section: shared
---

# Axi Local Registry

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/foundation/axi-registry`.
> Section: shared / Partition: `foundation/`.

## Summary

Local-only Verdaccio registry for publishing and installing @axi/* runtime packages.

## Stack

Verdaccio, pnpm

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Local Registry".
- Project root: `/Volumes/code/workspace/foundation/axi-registry`
- Project `AGENTS.md`: `/Volumes/code/workspace/foundation/axi-registry/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/foundation/axi-registry/README.md` (when present).

## Notes

Only `@axi/*` is intended for local package publication; public npm dependencies remain upstream.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
