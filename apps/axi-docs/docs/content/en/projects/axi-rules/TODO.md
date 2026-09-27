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


# Axi Rules — TODO

> Dossier TODO. Tracks what Axi Docs still needs to surface for this project.

## P0

- [ ] Confirm project root `AGENTS.md` / `README.md` still exist and match `WORKSPACE_INDEX.md`.
- [ ] Surface canonical verification commands (read from project `AGENTS.md` or `package.json`).

## P1

- [ ] Capture first-party MCP tool mapping if the project exposes one (e.g. `axi_docs_*` adapters, `workspace-project` consumer).
- [ ] Link to active consumers via `workspace.graph.json` (`workspace-project consumers <id>`).

## P2

- [ ] Add a thumbnail or icon if the project is a Dashboard app.
- [ ] Cross-link to Axi Rules entry (`rules/<family>/AGENTS.md`) when behavior rules reference this project.

## Out of Scope

- Project-internal TODOs live in the project root, not here.
