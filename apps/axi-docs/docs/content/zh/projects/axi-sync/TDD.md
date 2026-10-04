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

# Axi Change Sync — TDD Slice

> Axi Docs TDD slice for **Axi Change Sync**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-sync/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-sync` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-sync` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
