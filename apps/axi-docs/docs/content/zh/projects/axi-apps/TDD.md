---
id: axi-docs-zh-projects-axi-apps
title: Axi Applications
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Applications
graph-tags: [Projects, foundation]
description: AXI Personal OS Applications CLI (PRD-06, Phase 4). Three pure-reader sub-CLIs on the same live Kernel + downstream CLIs: Share (records shareable inbox items as Kernel Change rows + lists ResourceObject kind=shareable), Aggregate (one JSON payload fusing workbench partitions + inbox status + sync L0-L3 + runtime rule/skill/agent counts), Mobile (read-only JSON subset, size-bound for phone-class clients). Promoted from incubator/applications/ on 2026-09-21.
project:
  id: axi-apps
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-apps
  source-section: shared
---

# Axi Applications — TDD Slice

> Axi Docs TDD slice for **Axi Applications**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-apps/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-apps` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-apps` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
