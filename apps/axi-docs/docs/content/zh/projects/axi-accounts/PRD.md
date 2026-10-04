---
id: axi-docs-zh-projects-axi-accounts
title: Axi Accounts Contract
type: project
status: draft
tags: [Axi Docs, Projects, docs, shared]
created: 2026-09-28
modified: 2026-09-28
graph-title: Axi Accounts Contract
graph-tags: [Projects, docs]
description: workspace-resource
project:
  id: axi-accounts
  partition: docs
  path: /Volumes/code/workspace/docs/axi
  source-section: shared
---

# Axi Accounts Contract — PRD Slice

> Axi Docs PRD slice for **Axi Accounts Contract**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-ACCOUNTS-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Accounts Contract. |
| Acceptance | `docs/content/{en,zh}/projects/axi-accounts/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-ACCOUNTS-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-accounts` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.
