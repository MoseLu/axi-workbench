---
id: axi-docs-en-projects-axi-runtime
title: Axi Governance Runtime
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Governance Runtime
graph-tags: [Projects, foundation]
description: AXI Personal OS Governance Runtime CLI (PRD-05, Phase 3). Stand-up Rule Engine + Skill Registry + Agent Gateway + Scheduler on top of the Kernel Change stream. Rule / Skill / Agent live in a side-store data/governance.json (Phase 5 promotion will move them into Kernel schema). Default seed: 3 Rules (RULE-SCHEMA-CHANGE / RULE-LINK-DRIFT / RULE-CONFIRM-DOC), 3 Skills (SKILL-AXI-SYNC / SKILL-DOC-LINK / SKILL-CONTEXT-PACK), 1 Agent (AGENT-AXI-RUNTIME). Promoted from incubator/governance-runtime/ on 2026-09-21.
project:
  id: axi-runtime
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-runtime
  source-section: shared
---

# Axi Governance Runtime — TODO

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
