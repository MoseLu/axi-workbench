---
id: axi-docs-en-projects-axi-workspace-governance
title: Axi Workspace Governance
type: project
status: draft
tags: [Axi Docs, Projects, infra, axi-workspace-governance, governance]
created: 2026-08-08
modified: 2026-08-08
graph-title: Axi Workspace Governance
graph-tags: [Projects, infra, governance]
description: Workspace governance repo — registry, generated catalog, audit scripts, and governance docs. Source of truth: `/Volumes/code/workspace/infra/axi-workspace-governance/`.
project:
  id: axi-workspace-governance
  partition: infra
  path: /Volumes/code/workspace/infra/axi-workspace-governance
  source-section: shared
  mirror-strategy: hand-curated-minimal
---

# Axi Workspace Governance — Project Dossier

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/infra/axi-workspace-governance/`.
> Partition: infra.
> **Mirror strategy**: hand-curated minimal. This dossier only covers how Axi Docs **presents** the governance repo, not its content.

## Summary

`axi-workspace-governance` is the workspace governance repo:

- Maintains `workspace.json` (registry for projects, infra, tiers).
- Provides `scripts/workspace-project*` query scripts (CLI + MCP stdio) for Codex and shell workflows.
- Produces `docs/project-catalog.md`, `docs/adr/`, `docs/audits/`, etc.
- Mirrors content to `projects/axi-docs` via `mirrorTargets`.

## Stack

- Node.js, pnpm
- Markdown docs
- JSON Schema (project admission, incubation, project-docs manifest, etc.)

## Authoritative Documents

- Workspace entry: `/Volumes/code/workspace/infra/axi-workspace-governance`
- Workspace index: `WORKSPACE_INDEX.md` — "Shared And Infrastructure Foundations" section
- Registry source of truth: `workspace.json`
- ADRs: `docs/adr/`

## Notes

- This is a governance-only repo, not a monorepo or product code repository.
- Workspace root `/Volumes/code/workspace` is **not** a git repo; durable governance source changes happen here.
- Mirrored content (e.g. `docs/axi-workspace-governance/`) is **generated** by the governance repo; Axi Docs only reads it.

## Verification

- `pnpm workspace:registry:sync` — sync registry to `.workspace/registry.json`
- `pnpm workspace:audit` — workspace audit
- `/Volumes/code/workspace/scripts/workspace-project validate` — validate `workspace.graph.json`

## Cross-References

- `WORKSPACE_INDEX.md` — Shared And Infrastructure Foundations row
- `docs/axi/AXIOMATICWORLD_NAMING.md` — AxiomaticWorld naming contract
- `infra/axi-workspace-governance/workspace.json` — registry source of truth