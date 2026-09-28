---
source_of_truth: /Volumes/code/workspace/.claude/PARADIGM.md
mirror_strategy: verbatim-passthrough
last_mirrored_at: 2026-09-28
---

<!-- Layer: 1 | Paradigm | Updated: 2026-06-07 -->

# Workspace Development Paradigm

This file defines the meta-rules for work under `/Volumes/code/workspace`.
Read order: `.claude/PARADIGM.md` -> `.claude/ARCHITECTURE.md` -> module
`AGENTS.md` -> project-local docs.

## Core Principles

| Principle | Rule | Priority |
| --- | --- | --- |
| Index-first work | Resolve the canonical target through `WORKSPACE_INDEX.md` and `workspace.graph.json` before editing. | Required |
| Contract-first changes | Cross-project behavior changes must update or verify the contract listed in `workspace.graph.json`. | Required |
| PRD/TTD binding | Every P0/P1 workspace task must name a requirement ID or `[inferred]` requirement and at least one test case. | Required |
| Verification before completion | Claims are complete only after the narrowest meaningful verification passes or a documented gap remains. | Required |
| Secret isolation | Credentials and private operator data stay outside the workspace and are referenced only through secret refs. | Required |

## Requirement Flow

Workspace work is often operational rather than product-feature work. Use this
flow for both code and documentation changes:

```text
Requirement -> affected contract -> test or check design -> change -> verify -> index/docs sync
```

Requirement IDs:

- `WRK-INDEX-*`: workspace index, graph, and project discovery.
- `WRK-DOCS-*`: documentation architecture, manifests, and Axi Docs ingestion.
- `WRK-SVC-*`: dev services, PM2 profiles, ingress, and health checks.
- `WRK-SEC-*`: security policy, credentials, and sensitive path handling.
- `WRK-AI-*`: local AI capability routing and model/tool gateway contracts.

Use `[inferred]` when no formal PRD exists. Do not block small local fixes just
because the requirement was inferred; make the inference visible.

## TTD Flow

```text
Requirement -> validation command -> failing or missing check -> implementation -> passing check -> documentation sync
```

For documentation and registry changes, tests may be scripts, JSON parsing,
link/path existence checks, graph validation, or build-time indexing checks.

## Test Layers

| Layer | Target | Typical checks |
| --- | --- | --- |
| Structural | JSON, paths, manifests, doc references | `node -e`, `test -f`, manifest validators |
| Registry | Project index and graph consistency | `scripts/workspace-project validate` |
| Service | Dev service profiles and routing | `scripts/service/devsvc/devsvc doctor <profile>` |
| Project | Individual product or package behavior | Commands from `WORKSPACE_INDEX.md` |
| Docs hub | Axi Docs ingestion and build | `pnpm --dir projects/axi-docs/app governance:check`, `pnpm --dir projects/axi-docs/app verify` |

## Completion Rules

For every P0/P1 workspace task:

- Link a requirement ID.
- Name the affected files or contracts.
- Provide at least one test case template.
- Run the smallest check that proves the change.
- If a check cannot run, record the exact reason and the next-best evidence.

## Cross-Project Decision Tree

1. Is this a single project, shared runtime, infrastructure, or root workspace change?
2. Which project or contract owns the surface?
3. Does `workspace.graph.json` list providers or consumers that must be checked?
4. Does `WORKSPACE_INDEX.md` list a verification command?
5. Does the target project have a deeper `AGENTS.md`, `CLAUDE.md`, or README?
6. Is any action destructive, credential-gated, production-facing, or a release?

If the answer to step 6 is yes, follow the owner approval rules in root
`AGENTS.md` and `SECURITY.md`.

## Violations

| Violation | Severity | Response |
| --- | --- | --- |
| Editing a project without resolving the canonical path | High | Stop and re-resolve through `WORKSPACE_INDEX.md`. |
| Cross-project contract change without graph/consumer check | High | Update or verify `workspace.graph.json`, then run provider and consumer checks. |
| P0/P1 task without requirement and test case | Medium | Add `[inferred]` requirement and validation case before marking complete. |
| Workspace docs not visible to Axi Docs when intended for operators | Medium | Update the Axi Docs source or ingestion rules. |
| Secrets copied into docs, logs, comments, or examples | Critical | Revoke/rotate and remove from history; documentation edits are not sufficient. |

<!-- MANUAL: workspace-specific paradigm notes preserved across updates -->
