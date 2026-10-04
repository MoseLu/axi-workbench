---
id: axi-docs-en-projects-axi-sync
title: Axi Change Sync
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Change Sync
graph-tags: [Projects, foundation]
description: AXI Personal OS Change Sync CLI (PRD-04, Phase 2/3). Reads the live Kernel `Change` stream plus `git log` of registered repositories; rates each change L0-L3 by keyword heuristics; maintains a side-store queue with state machine (detected → queued → analyzing → need-review → accepted / ignored / failed); generates daily reports. Promoted from incubator/change-sync/ on 2026-09-21.
project:
  id: axi-sync
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-sync
  source-section: shared
---

# Axi Change Sync

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/foundation/axi-sync`.
> Section: shared / Partition: `foundation/`.

## Summary

AXI Personal OS Change Sync CLI (PRD-04, Phase 2/3). Reads the live Kernel `Change` stream plus `git log` of registered repositories; rates each change L0-L3 by keyword heuristics; maintains a side-store queue with state machine (detected → queued → analyzing → need-review → accepted / ignored / failed); generates daily reports. Promoted from incubator/change-sync/ on 2026-09-21.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Change Sync".
- Project root: `/Volumes/code/workspace/foundation/axi-sync`
- Project `AGENTS.md`: `/Volumes/code/workspace/foundation/axi-sync/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/foundation/axi-sync/README.md` (when present).

## Notes

AXI Personal OS Change Sync CLI (PRD-04, Phase 2/3). Reads the live Kernel `Change` stream plus `git log` of registered repositories; rates each change L0-L3 by keyword heuristics; maintains a side-store queue with state machine (detected → queued → analyzing → need-review → accepted / ignored / failed); generates daily reports. Promoted from incubator/change-sync/ on 2026-09-21.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
