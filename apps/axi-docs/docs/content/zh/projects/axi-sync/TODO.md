---
id: axi-docs-zh-projects-axi-sync
title: Axi Change Sync
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Change Sync
graph-tags: [Projects, foundation]
description: AXI Personal OS Change Sync CLI (PRD-04, Phase 2/3). Reads the live Kernel `Change` stream plus `git log` of registered repositories; rates each change L0-L3 by keyword heuristics; maintains a side-store queue with state machine (detected → queued → analyzing → need-review → accepted / ignored / failed); generates daily reports. Promoted from incubator/change-sync/ on 2026-09-21.
project:
  id: axi-sync
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-sync
  source-section: shared
---

# Axi Change Sync — TODO

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
