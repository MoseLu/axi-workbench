---
id: axi-docs-en-projects-axi-workspace-governance
title: Axi Workspace Governance — Agent Contract
type: project
status: draft
tags: [Axi Docs, Projects, infra, axi-workspace-governance, governance]
created: 2026-08-08
modified: 2026-08-08
graph-title: Axi Workspace Governance
graph-tags: [Projects, infra, governance]
description: Axi Workspace Governance dossier — Agent contract.
project:
  id: axi-workspace-governance
  partition: infra
  path: /Volumes/code/workspace/infra/axi-workspace-governance
  source-section: shared
  mirror-strategy: hand-curated-minimal
---

# Axi Workspace Governance — Agent Contract

> This dossier is the Axi Docs **Axi Workspace Governance** agent contract (workspace path: `/Volumes/code/workspace/infra/axi-workspace-governance`).
> It does **not** replace any project-root files; it only describes how Axi Docs **presents** the governance repo.

## Reading Order

1. This file (the dossier)
2. `docs/content/{en,zh}/projects/axi-workspace-governance/README.md` — dossier summary
3. `/Volumes/code/workspace/infra/axi-workspace-governance/workspace.json` — registry source of truth
4. `/Volumes/code/workspace/WORKSPACE_INDEX.md` — human-readable workspace index

## Boundaries

- Axi Docs treats this repo as a **governance source of truth** and does not modify `infra/axi-workspace-governance/`.
- Registry / catalog / ADR / audit updates happen in the governance repo and then mirror to Axi Docs via `mirrorTargets`.
- This dossier is intentionally **3 files only** (README + AGENTS + INDEX); it does not try to mirror the full `workspace.json` schema.

## Update Cadence

- When `workspace.json` adds or removes projects, re-run `pnpm workspace:registry:sync` and manually refresh this dossier's "Summary" section.
- When `WORKSPACE_INDEX.md` changes the Shared And Infrastructure Foundations section, refresh this dossier in lock-step.