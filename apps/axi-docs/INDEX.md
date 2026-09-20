# Axi Docs Index

## Ownership

- Root: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs`
- Type: workspace project (knowledge surface; `app/` holds the application code)
- Stack signals: React + TypeScript + Vite + Node.js MCP + Markdown

## Document Map

| Document | Purpose |
| --- | --- |
| `README.md` | English entrypoint and quickstart. |
| `README.zh-CN.md` | Simplified Chinese entrypoint. |
| `AGENTS.md` | Agent rules, boundaries, verification, read order. |
| `ARCHITECTURE-AXI-STACK.md` | Axi Skills × Axi Rules × Axi Docs × shared/axi-ui shared-stack architecture (capability / behavior / knowledge / shared-UI layers). |
| `plans/README.md` | Root-level planning category index for agents inspecting the current directory. |
| `docs/content/{en,zh}/plans/` | Durable idea-to-landing plan library; execution items link out to Axi Todo. |
| `docs/state/PRD.md` | Product/project requirements and non-goals. |
| `docs/state/TDD.md` | Technical/test design and verification commands. |
| `docs/state/VERIFICATION.md` | Verification contract for docs, app config, source locks, and plans library changes. |
| `docs/state/MILESTONE.md` | Delivery milestone and evidence. |
| `docs/state/CHANGELOG.md` / `CHANGELOG.zh-CN.md` | Human-visible change log. |
| `docs/state/TODO.md` / `TODO.zh-CN.md` | Task facade pointing at `todo/01-current-architecture.md` (current backlog), `todo/02-legacy-audit.md`, `todo/03-coverage-remediation.md`, `todo/04-roadmap.md`. |
| `docs/state/ERROR.md` / `ERROR.zh-CN.md` | Failure mode catalog. |
| `docs/governance/SECURITY.md` / `SECURITY.zh-CN.md` | Security policy. |
| `docs/governance/THIRD_PARTY_NOTICES.md` / `*.zh-CN.md` | Third-party notices. |
| `docs/project-docs.manifest.json` | Project documentation manifest. |
| `docs/axi-workspace-governance/` | Mirrored workspace governance catalog and state. |
| `/Volumes/code/workspace/shared/axi-ui/docs/INTEGRATION.md` | External authoritative entrypoint for new `@axi/*` consumer projects (see AR-ROUTING-007 in axiom-rules). |
| `/Volumes/code/workspace/shared/axi-ui/INDEX.md` | External authoritative entrypoint for axiom-ui maintainers (Package Map, Document Map). |

## Top-Level Inventory

- `AGENTS.md`
- `ARCHITECTURE-AXI-STACK.md`
- `README.md` / `README.zh-CN.md`
- `plans/` (root-level planning category index)
- `docs/state/{PRD,TDD,VERIFICATION,MILESTONE,CHANGELOG,TODO,ERROR}.md` and `.zh-CN.md` mirrors
- `docs/governance/{SECURITY,THIRD_PARTY_NOTICES}.md` and `.zh-CN.md` mirrors
- `docs/content/{en,zh}/plans/` (durable plan library)
- `docs/axi-workspace-governance/` (mirror of `infra/axi-workspace-governance/docs/`)
- `docs/project-docs.manifest.json` / `projects.index.json` / `sources.lock.json`
- `app/` (canonical application code; see `app/AGENTS.md`)
- `blinko` (imported reference repo)
- `todo/`

## Source of Truth

- Existing source files and package manifests define implementation reality.
- This document maps local documentation and does not replace code-level ownership.