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

# Axi Governance Runtime — TDD Slice

> Axi Docs TDD slice for **Axi Governance Runtime**. Describes the test design for the dossier itself, not the project.

## Unit checks

- `pnpm --dir app projects:check` walks `docs/content/{en,zh}/projects/axi-runtime/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` and asserts every expected piece exists with valid frontmatter.
- `pnpm --dir app projects:check --project=axi-runtime` runs the same checks scoped to this project.

## Manual checks

- Open the dossier in the Axi Docs web app and confirm it routes under `/en/projects/axi-runtime` (and `/zh/...`).
- Verify the knowledge graph renders a node for this project (graph-title and graph-tags must be unique enough).

## Failure modes

- Missing piece → `projects:check` exits non-zero with the missing path in the error.
- Stale purpose statement → re-run `projects:build` to regenerate from `WORKSPACE_INDEX.md`.
- Stale project root path → update `WORKSPACE_INDEX.md` first; the dossier follows.
