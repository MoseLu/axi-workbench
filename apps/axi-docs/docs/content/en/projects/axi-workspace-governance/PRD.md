---
id: axi-docs-en-projects-axi-workspace-governance
title: Axi Workspace Governance
type: project
status: draft
tags: [Axi Docs, Projects, foundation, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Workspace Governance
graph-tags: [Projects, foundation]
description: Workspace registry, generated catalog, audit scripts, and governance docs.
project:
  id: axi-workspace-governance
  partition: foundation
  path: /Volumes/code/workspace/foundation/workspace-governance
  source-section: shared
---

# Axi Workspace Governance — PRD Slice

> Axi Docs PRD slice for **Axi Workspace Governance**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-WORKSPACE-GOVERNANCE-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Workspace Governance. |
| Acceptance | `docs/content/{en,zh}/projects/axi-workspace-governance/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-WORKSPACE-GOVERNANCE-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-workspace-governance` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
