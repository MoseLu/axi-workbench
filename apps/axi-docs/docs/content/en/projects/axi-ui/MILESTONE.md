---
id: axi-docs-en-projects-axi-ui
title: Axi UI
type: project
status: active
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi UI
graph-tags: [Projects, shared]
description: Axi shared UI runtime layer (tokens + react + react-antd + react-addons). Drives the Axi Dashboard shell used by workbench, axiom-agent-platform, axiom-pet-desktop, axiom-pet, and axiom-image-preview. Refreshed against the 2026-08 workbench dual-app posture.
project:
  id: axi-ui
  partition: shared
  path: /Volumes/code/workspace/shared/axi-ui
  source-section: shared
---
## 2026-08-08 Refresh Note

axi-ui sits underneath all Axi-om dashboards and the workbench shell. Two follow-up edges in the 2026-08 batch: a brand-new tools/axi-app-cli import dependency split, and the workbench @axi/shell upgrade to 0.3.0 / AxiTabActionMenu. This mirror notes those changes; canonical changelog is at the package root.


# Axi UI — Milestone

> Dossier milestone. Tracks the **public surface** of this project as seen from Axi Docs.



## Current State

- Workspace status: **stale** (lastVerifiedAt = 2026-07-23   per the workspace handoff snapshot).
- Dossier: active, refreshed 2026-08-08 to track the   workbench shell migration (AxiTabActionMenu in   @axi/shell 0.3.0).
- 4 public packages exposed: tokens, react, react-antd,   react-addons.

## Exit Criteria (to keep dossier accurate)

- [ ] Shared UI package set publishes its own next major   minor after the workbench shell migration.
- [ ] `pnpm --filter @axi/ui test` and `pnpm --filter   @axi/react test` are green on this repository's lockfile.

## Long-Term

- [ ] Promote from `status: active` to `status: published`   once the shared/ui team signs off.
- [ ] Mirror refresh every 14 days under AR-HANDOFF-006.
