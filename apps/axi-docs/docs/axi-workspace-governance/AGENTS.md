# Axi Workspace Governance Agent Guide

## Scope

This file governs work under `/Volumes/code/workspace/infra/axi-workspace-governance`. Read it before editing files in this root.

This is a workspace-owned root unless a nested AGENTS.md narrows the boundary.

## Read Order

1. This `AGENTS.md`.
2. `README.md` and `README.zh-CN.md`.
3. `INDEX.md`, `PRD.md`, and `TDD.md` before changing behavior or docs.
4. Nested `AGENTS.md` files, package manifests, and test configs in the target module.

## Boundaries

- Keep edits inside `/Volumes/code/workspace/infra/axi-workspace-governance` unless the user explicitly assigns cross-project work.
- Preserve manual sections marked `<!-- MANUAL -->`.
- Prefer small documentation updates tied to existing files, commands, and ownership.
- Do not commit secrets, generated caches, local run state, `node_modules`, build outputs, or agent transcripts.

## Verification

Run the closest applicable check after edits:

- `pnpm install`
- `pnpm test`
- `pnpm build`

For documentation-only edits, at minimum verify required docs exist and contain the project name, PRD, TDD, TODO, and milestone references.
