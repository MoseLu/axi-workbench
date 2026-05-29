# Package Notes
Last updated: 2026-04-03 16:33:20 +08:00
Parent: [AGENTS.md](../../AGENTS.md)
Scope: apps/cli

## Role

- Publishable CLI shell for `axi` and `create-axi-app`
- Thin handoff layer into `@axi/scaffold-runtime`

## Local Constraints

- Keep `src/cli.ts` minimal and stable.
- Do not import `foundation-*` or `feature-*` packages directly.
- Do not move command orchestration or policy logic into this package.
- Keep binary behavior aligned with the public CLI surface documented at the repo root.

## Current Focus

- Preserve a thin bootstrap boundary while runtime hardening continues below this layer.
- Keep package metadata, bin wiring, and build output predictable for local dev and future publish flows.
