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

# Axi Governance Runtime — PRD Slice

> Axi Docs PRD slice for **Axi Governance Runtime**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-RUNTIME-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Governance Runtime. |
| Acceptance | `docs/content/{en,zh}/projects/axi-runtime/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-RUNTIME-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-runtime` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
