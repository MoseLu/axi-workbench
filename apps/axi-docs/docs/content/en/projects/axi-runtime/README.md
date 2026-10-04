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

# Axi Governance Runtime

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/foundation/axi-runtime`.
> Section: shared / Partition: `foundation/`.

## Summary

AXI Personal OS Governance Runtime CLI (PRD-05, Phase 3). Stand-up Rule Engine + Skill Registry + Agent Gateway + Scheduler on top of the Kernel Change stream. Rule / Skill / Agent live in a side-store data/governance.json (Phase 5 promotion will move them into Kernel schema). Default seed: 3 Rules (RULE-SCHEMA-CHANGE / RULE-LINK-DRIFT / RULE-CONFIRM-DOC), 3 Skills (SKILL-AXI-SYNC / SKILL-DOC-LINK / SKILL-CONTEXT-PACK), 1 Agent (AGENT-AXI-RUNTIME). Promoted from incubator/governance-runtime/ on 2026-09-21.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Governance Runtime".
- Project root: `/Volumes/code/workspace/foundation/axi-runtime`
- Project `AGENTS.md`: `/Volumes/code/workspace/foundation/axi-runtime/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/foundation/axi-runtime/README.md` (when present).

## Notes

AXI Personal OS Governance Runtime CLI (PRD-05, Phase 3). Stand-up Rule Engine + Skill Registry + Agent Gateway + Scheduler on top of the Kernel Change stream. Rule / Skill / Agent live in a side-store data/governance.json (Phase 5 promotion will move them into Kernel schema). Default seed: 3 Rules (RULE-SCHEMA-CHANGE / RULE-LINK-DRIFT / RULE-CONFIRM-DOC), 3 Skills (SKILL-AXI-SYNC / SKILL-DOC-LINK / SKILL-CONTEXT-PACK), 1 Agent (AGENT-AXI-RUNTIME). Promoted from incubator/governance-runtime/ on 2026-09-21.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.
