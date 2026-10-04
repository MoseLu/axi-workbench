---
id: axi-docs-zh-projects-axi-sync
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

# Axi Change Sync — CHANGELOG Mirror

> Mirror of the project root `CHANGELOG.md` at `/Volumes/code/workspace/foundation/axi-sync/CHANGELOG.md`.
> Axi Docs does not own this content; the project root is the source of truth.

## Re-mirror

- Run `pnpm --dir app projects:build` to refresh this dossier piece.
- For full content, read the source at `/Volumes/code/workspace/foundation/axi-sync/CHANGELOG.md`.
