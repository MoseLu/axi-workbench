---
id: axi-docs-zh-projects-axi-inbox
title: Axi Inbox
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Inbox
graph-tags: [Projects, foundation]
description: AXI Personal OS Inbox CLI (PRD-03, Phase 2). Collects URLs, images, files, ideas, project-refs into a single inbox; auto-detects kind via URI heuristics; transitions through collected/unread/reviewed/linked/transformed/archived; transforms inbox items into Document / Resource (kind=shareable|kind=inspiration|kind=task). Promoted from incubator/resource-inbox/ on 2026-09-21.
project:
  id: axi-inbox
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-inbox
  source-section: shared
---

# Axi Inbox — TDD Slice

> Axi Docs TDD slice for **Axi Inbox**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-inbox/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-inbox` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-inbox` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
