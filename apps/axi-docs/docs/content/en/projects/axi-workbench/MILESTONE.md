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

Project root `MILESTONE.md` is a builder-friendly stub. Canonical milestone lives at `docs/state/MILESTONE.md` (four milestone records with evidence + exit criteria). Workbench status is currently **verified**, with last verified 2026-08-07.


# Axi Workbench — Milestone

> Dossier milestone. Tracks the **public surface** of this project as seen from Axi Docs.



## Current State

- Workspace status: **verified** (per project root `docs/state/MILESTONE.md` and `docs/HANDOFF.md`; last verified 2026-08-07).
- Dossier: active, refreshed on 2026-08-07 to match the v3 dual-app workbench (Web admin `apps/workbench` + mobile `apps/workbench-mobile`).
- Two independent user applications are present: `apps/workbench` (Web admin SPA) and `apps/workbench-mobile` (mobile app). Shared session / locale live in `@axi/workbench-foundation`.

## Exit Criteria (to keep dossier accurate)

- [x] Dossier `README.md` summarises the project without claiming implementation details that the project does not document itself.
- [ ] `pnpm --dir app projects:check` passes.
- [ ] Cross-references to `WORKSPACE_INDEX.md` and project root `AGENTS.md` are accurate after each batch.

## Long-Term

- [ ] Promote from `status: active` to `status: published` once content is reviewed by Axi Docs owner.
- [ ] Add a `docs/content/{en,zh}/projects/axi-workbench/CHANGELOG.md` if the project emits user-visible changes worth tracking in Axi Docs.
