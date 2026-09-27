# Axi Docs Architecture

<!-- deep-init:layer=L2 -->

## System Layers

1. Project entrypoint
   - `README.md`
   - `AGENTS.md`
   - `TODO.md`
   - `MILESTONE.md`
   - `docs/project-docs.manifest.json`

2. Application package
   - `app/src` implements the React UI and local knowledge runtime.
   - `app/src/lib/knowledgeBase.ts` normalizes markdown, skills, API notes, and workspace registry sources.
   - `app/src/mcp` exposes the MCP document bus.
   - `app/scripts` owns governance, source lock, and verification checks.

3. Documentation sources
   - `docs/content/en` is the English product documentation source.
   - `docs/content/zh` is the Simplified Chinese product documentation source.
   - `docs/axi-workspace-governance` is a workspace governance mirror.
   - `docs/sources.lock.json` pins external source revisions.

4. Workspace contracts
   - `/Volumes/code/workspace/WORKSPACE_INDEX.md` provides project registry rows.
   - `/Volumes/code/workspace/workspace.graph.json` provides graph contracts.
   - `/Volumes/code/workspace/.claude` provides workspace-level L1/L2 guidance.

## Reference Chain

- L1: `.claude/PARADIGM.md`
- L2: `.claude/ARCHITECTURE.md`
- L3: `AGENTS.md`, `app/AGENTS.md`, `docs/content/README.md`, `TODO.md`, `MILESTONE.md`
- Verification: `app/scripts/check-docs.mjs`, `app/scripts/check-source-locks.mjs`, `pnpm --dir app verify`

## Change Boundaries

- Do not edit upstream workspace governance content through the mirror.
- Do not vendor Axi Skills content into this repo; update `docs/sources.lock.json` and CI checkout inputs instead.
- Do not treat `.omx/state` files as project source.
- Keep workspace virtual documents read-only and generated from source files.

## Validation Map

- Manifest drift: `pnpm --dir app docs:check`
- Source lock drift: `pnpm --dir app source:check`
- Adapter behavior: `pnpm --dir app test:run`
- Full package readiness: `pnpm --dir app verify`

<!-- MANUAL: update this architecture when adapters, source ownership, or verification boundaries change. -->
