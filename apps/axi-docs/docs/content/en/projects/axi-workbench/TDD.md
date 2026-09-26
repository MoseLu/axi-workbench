---
id: axi-docs-en-projects-axi-workbench
title: Axi Workbench
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-08-07
modified: 2026-08-07
graph-title: Axi Workbench
graph-tags: [Projects, projects]
description: Canonical AxiomaticWorld workbench for the six-layer control plane, two independent user applications (Web admin apps/workbench and mobile app apps/workbench-mobile), shared contracts, local services, AI integrations, fleet tooling, and app scaffolding.
project:
  id: axi-workbench
  partition: projects
  path: /Volumes/code/workspace/projects/axi-workbench
  source-section: core
---
## 2026-08-07 Refresh Note

Project root `TDD.md` is a builder-friendly stub. Canonical TDD lives at `docs/state/TDD.md` (Architecture Assumptions + Test Surface Map + per-surface verification + Risk Cases). Web admin and mobile application now have separate contract verifiers and verification lanes.


# Axi Workbench — TDD Slice

> Axi Docs TDD slice for **Axi Workbench**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-workbench/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-workbench` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-workbench` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
