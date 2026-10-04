---
id: axi-docs-en-projects-axi-workbench-web-dist
title: Axi Workbench Web Distribution
type: project
status: draft
tags: [Axi Docs, Projects, distributions, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workbench Web Distribution
graph-tags: [Projects, distributions]
description: Axi Workbench Web Distribution is a standalone monorepo for web deployment, wrapping the Axi Workbench UI with Turbo, React, and shared @axi/* packages.
project:
  id: axi-workbench-web-dist
  partition: distributions
  path: /Volumes/code/workspace/distributions/axi-workbench-web
  source-section: reference
---

# Axi Workbench Web Distribution — PRD Slice

> Axi Docs PRD slice for **Axi Workbench Web Distribution**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-WORKBENCH-WEB-DIST-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Workbench Web Distribution. |
| Acceptance | `docs/content/{en,zh}/projects/axi-workbench-web-dist/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-WORKBENCH-WEB-DIST-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-workbench-web-dist` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
