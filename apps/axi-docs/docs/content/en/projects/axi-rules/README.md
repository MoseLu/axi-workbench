---
id: axi-docs-en-projects-axi-rules
title: Axi Rules
type: project
status: active
tags: [Axi Docs, Projects, projects, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Rules
graph-tags: [Projects, projects]
description: Axi shared rule and SOP authority. The 2026-08 workbench batch added AR-LIFECYCLE-004/005, AR-VERIFY-004/005, and AR-HANDOFF-006 covering the v3 dual-app workbench posture, dual-lane verification recipe, and docs/rules freshness sync. Total rules now 55 (was 50).
project:
  id: axi-rules
  partition: projects
  path: /Volumes/code/workspace/projects/axi-rules
  source-section: shared
---
## 2026-08-08 Refresh Note

axi-rules gained six new AR-* rule entries in the 2026-08 workbench follow-up (AR-LIFECYCLE-004/005, AR-VERIFY-004/005, AR-HANDOFF-006). Total rules now 55. Mirror reflects that delta; canonical rule definitions live in projects/axi-rules/rules/*/AGENTS.md.


# Axi Rules

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/projects/axi-rules`.
> Section: shared / Partition: `projects/`.

## Summary

Local authority for Axi agent routing, memory, safety, verification, and generated project/rule indexes, with a React visualization of the memory pipeline.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Rules".
- Project root: `/Volumes/code/workspace/projects/axi-rules`
- Project `AGENTS.md`: `/Volumes/code/workspace/projects/axi-rules/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/projects/axi-rules/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
