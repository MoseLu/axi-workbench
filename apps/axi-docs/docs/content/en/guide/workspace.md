---
id: axi-docs-en-guide-workspace
title: Workspace
type: guide
status: published
tags: [Axi Docs, Workspace, governance, English]
created: 2026-06-07
modified: 2026-06-07
graph-title: Workspace
graph-tags: [Axi Docs, Workspace]
description: Understand how Workspace organizes project indexes, governance, and durable knowledge.
---

## The Workspace document set

Workspace connects the Axi workspace governance repository and presents project catalogs, governance rules, and cross-project knowledge. It is a structured reading and retrieval surface rather than a raw file browser.

## Catalog organization

The sidebar comes from the Workspace catalog. Groups contain descriptions, document counts, and pages; the main area presents source context, recent updates, and openable entries.

## Appropriate content

- Project purpose, boundaries, and dependencies.
- Cross-repository governance and operating procedures.
- Architecture decisions, migrations, and maintenance guides.
- Reusable diagnostic and verification evidence.

## Boundary with Skills

Workspace answers what a project or environment is. Skills answers how to execute a reusable task. Link between them instead of copying the same runbook into both sets.

## Workspace State Documents

The Axi workspace maintains a five-piece set of long-term state documents under `docs/state/`, mirrored to `apps/axi-docs/docs/axi-workspace-governance/state/`:

| Document | Purpose |
| --- | --- |
| `README.md` | Directory entry and file-type matrix |
| `PRD.md` | Workspace root PRD (REQ-DOC-001 / REQ-VERIFY-001 / REQ-BOUNDARY-001 / REQ-MILESTONE-001) |
| `TDD.md` | Workspace root TDD (architecture hypotheses, verification commands) |
| `TODO.md` | Workspace root P0/P1/P2 task queue |
| `MILESTONE.md` | Workspace root milestone records (WRK.1 / WRK.2 / WRK.3) with exit criteria |
| `VERIFICATION.md` | Workspace verification status (auto-generated) |
| `CLI-REFERENCE.md` | workspace-project / devsvc / foundation CLI reference |

Historical event snapshots (LOG-STD / TASK3 / audit-remediation / git-ahead) are archived under `apps/axi-docs/docs/axi-workspace-governance/audits/2026-09-25/`.

## Workspace Architecture & Operations

Long-term architectural and operational docs live under `docs/architecture/`, `docs/audit/`, `docs/registry/`, and `docs/prd/`. They are mirrored under:

- `apps/axi-docs/docs/axi-workspace-governance/workspace-architecture/` — workspace-level architecture (7 docs)
- `docs/axi-workspace-governance/audit/` — workspace-level audits (2 docs)
- `docs/axi-workspace-governance/registry/` — workspace-level registry (1 doc)
- `docs/axi-workspace-governance/prd/` — PRD center (6 docs)

The ADR entry point is `/Volumes/code/workspace/docs/adr/README.md`, which delegates to the canonical `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/` directory.

## ADR Authority

There are three ADR directories in this workspace:
1. `/Volumes/code/workspace/docs/adr/` — placeholder for ad-hoc ADRs (1 README)
2. `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/adr/` — mirror of governance repo
3. `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/` — **canonical authority**

Use `axi_docs_list_governance_adrs` to enumerate all three.

## Axi Branding & Contracts

The Axi workspace maintains a brand naming contract under `docs/axi/`, mirrored to `apps/axi-docs/docs/axi-workspace-governance/axi/`:

| Document | Type | Mirror Location |
| --- | --- | --- |
| `AXIOMATICWORLD_NAMING.md` (en/zh-CN) | Brand naming contract | `axi/AXIOMATICWORLD_NAMING.md` |
| `contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md` | Workspace shared schema (467 lines, strong contract) | `axi/contracts/` |
| `contracts/AI_CAPABILITY_CONTRACT.md` | cc-connect ai-capability contract | `axi/contracts/` |
| `contracts/MINIMAX_TOKENPLAN_CONTRACT.md` | cc-connect minimax-tokenplan contract | `axi/contracts/` |
| `contracts/OLLAMA_LOCAL_CONTRACT.md` | cc-connect ollama-local contract | `axi/contracts/` |
| `merge-plans/AXI_*.md` (4 files, archived) | Historical merge plans (frozen) | `axi/archive/` |

Use `axi_docs_read_workspace_doc(category='axi', path='contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md')` to read these.

## Workspace Meta-Docs (Layer 1-2)

The Claude CLI meta-docs `.claude/PARADIGM.md` (Layer 1: paradigm) and `.claude/ARCHITECTURE.md` (Layer 2: architecture) define the workspace-level conventions. They are mirrored to:

- `apps/axi-docs/docs/axi-workspace-governance/claude-meta/PARADIGM-WORKSPACE-ROOT.md`
- `apps/axi-docs/docs/axi-workspace-governance/claude-meta/ARCHITECTURE-WORKSPACE-ROOT.md`

These are the "constitution" of the AxiomaticWorld workspace and are read by every agent on first contact.

## Scripts & Incubator

The `scripts/` directory hosts root-level launcher scripts and layer-3 module docs (AGENTS.md / README.md), mirrored to `apps/axi-docs/docs/axi-workspace-governance/scripts/`. The `incubator/` directory is a non-project validation area and is intentionally NOT indexed by Axi Docs; new ideas enter here first, then promote to `foundation/` or `products/` via `workspace-project route-intent`.
