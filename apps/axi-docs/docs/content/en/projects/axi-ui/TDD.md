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


# Axi UI — TDD Slice

> Axi Docs TDD slice for **Axi UI**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-ui/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-ui` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-ui` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
