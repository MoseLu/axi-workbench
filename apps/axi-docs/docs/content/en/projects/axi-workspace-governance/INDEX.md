---
id: axi-docs-en-projects-axi-workspace-governance
title: Axi Workspace Governance — Dossier Index
type: project
status: draft
tags: [Axi Docs, Projects, infra, axi-workspace-governance, governance]
created: 2026-08-08
modified: 2026-08-08
graph-title: Axi Workspace Governance
graph-tags: [Projects, infra, governance]
description: Axi Workspace Governance dossier — internal index.
project:
  id: axi-workspace-governance
  partition: infra
  path: /Volumes/code/workspace/infra/axi-workspace-governance
  source-section: shared
  mirror-strategy: hand-curated-minimal
---

# Axi Workspace Governance — Dossier Index

## Dossier Files

| File | Purpose |
|---|---|
| `README.md` | Dossier summary (purpose, stack, status, notes). |
| `AGENTS.md` | Reading order, boundaries, update cadence. |
| `INDEX.md` | This file — dossier-internal index. |

## Governance Repo Internal Layout (reference, not mirrored)

- `workspace.json` — registry source of truth for projects, infra, tiers
- `scripts/` — `workspace-project*` query scripts (CLI + MCP stdio)
- `docs/adr/` — architecture decision records
- `docs/audits/` — audit reports
- `docs/project-catalog.md` — generated catalog
- `schemas/` — JSON Schema definitions
- `templates/` — project admission, incubation, etc.

## Cross-References

- `WORKSPACE_INDEX.md` — Shared And Infrastructure Foundations section
- `docs/axi/AXIOMATICWORLD_NAMING.md`
- `infra/axi-workspace-governance/workspace.json`