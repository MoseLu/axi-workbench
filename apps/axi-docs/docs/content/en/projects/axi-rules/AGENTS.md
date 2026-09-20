---
id: axi-docs-en-projects-axi-rules
title: Axi Rules
type: project
status: active
tags: [Axi Docs, Projects, projects, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Rules
graph-tags: [Projects, projects]
description: Axi shared rule and SOP authority. The 2026-08 workbench batch added AR-LIFECYCLE-004/005, AR-VERIFY-004/005, and AR-HANDOFF-006 covering the v3 dual-app workbench posture, dual-lane verification recipe, and docs/rules freshness sync. Total rules now 55 (was 50).
project:
  id: axi-rules
  partition: projects
  path: /Volumes/code/workspace/projects/axi-rules
  source-section: shared
---
## 2026-08-08 Refresh Note

axi-rules gained six new AR-* rule entries in the 2026-08 workbench follow-up (AR-LIFECYCLE-004/005, AR-VERIFY-004/005, AR-HANDOFF-006). Total rules now 55. Mirror reflects that delta; canonical rule definitions live in projects/axi-rules/rules/*/AGENTS.md.


# Axi Rules — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Rules** (workspace path: `/Volumes/code/workspace/projects/axi-rules`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-rules/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/projects/axi-rules/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/projects/axi-rules/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/projects/axi-rules`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
