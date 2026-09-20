---
id: axi-docs-en-projects-opencodex-reference
title: OpenCodex Reference
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: OpenCodex Reference
graph-tags: [Projects, references]
description: Reference local Codex gateway with Computer Use proxy, model-routing dashboard, and a local macOS wrapper app.
project:
  id: opencodex-reference
  partition: references
  path: /Volumes/code/workspace/references/opencodex
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# OpenCodex Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/opencodex`.
> Section: reference / Partition: `references/`.

## Summary

Reference local Codex gateway with Computer Use proxy, model-routing dashboard, and a local macOS wrapper app.

## Stack

Node.js, TypeScript, Swift/AppKit, WebKit

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "OpenCodex Reference".
- Project root: `/Volumes/code/workspace/references/opencodex`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/opencodex/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/references/opencodex/README.md` (when present).

## Notes

Upstream AITabby reference repo with local wrapper edits; not an Axi owner or active application.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
