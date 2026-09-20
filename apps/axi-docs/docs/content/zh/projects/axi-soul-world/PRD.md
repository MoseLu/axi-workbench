---
id: axi-docs-zh-projects-axi-soul-world
title: Axi Soul World
type: project
status: draft
tags: [Axi Docs, Projects, products, reference]
created: 2026-08-23
modified: 2026-08-23
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: A multi-surface local-first product: core backend in this repo, Axi Mood on Android, and an admin Web (later Mac) that logs in by phone QR scan.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: reference
---

# Axi Soul World — PRD Slice

> Axi Docs PRD slice for **Axi Soul World**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-SOUL-WORLD-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Soul World. |
| Acceptance | `docs/content/{en,zh}/projects/axi-soul-world/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-SOUL-WORLD-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-soul-world` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
