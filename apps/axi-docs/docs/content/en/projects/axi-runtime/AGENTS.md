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

# Axi Governance Runtime — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Governance Runtime** (workspace path: `/Volumes/code/workspace/foundation/axi-runtime`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-runtime/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/foundation/axi-runtime/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/foundation/axi-runtime/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/foundation/axi-runtime`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).
