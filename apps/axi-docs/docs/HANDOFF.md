# Axi Docs Handoff

- Project: `axi-docs`
- Path: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs`
- Owner: `AxiomaticWorld workspace owner`
- Readiness: `verified`
- Purpose: Workspace documentation hub combining a React reader, knowledge-source adapters, knowledge graph, MCP document bus, and generated project dossier mirrors.

## 90-Second Read Order

1. `AGENTS.md`
2. `README.md`
3. `app/AGENTS.md`
4. `docs/state/TODO.md`
5. `docs/state/MILESTONE.md`

## Entrypoints

- `app/src/main.tsx`: Mount the React documentation reader and knowledge hub.
- `app/src/mcp/server.ts`: Expose the Axi Docs MCP and HTTP document-access surfaces.
- `app/scripts/build-projects-index.mjs`: Generate workspace project dossier mirrors and their index.
- `app/scripts/check-source-locks.mjs`: Validate external documentation source locks.

## Commands

- Setup: `pnpm --dir app install --frozen-lockfile`
- Start: `pnpm --dir app dev`
- Start: `pnpm --dir app mcp:http`
- Health: `pnpm --dir app docs:check`
- Health: `pnpm --dir app source:check`
- Verify: `pnpm --dir app verify`
- Verify: `pnpm --dir app test:run`
- Verify: `pnpm --dir app rule:check`
- Smoke: `pnpm --dir app docs:check`
- Smoke: `pnpm --dir app verify`

## Environment

- Runtimes: `Node.js`, `pnpm`
- Services: `Blinko when the Blinko source is enabled`, `Anthropic-compatible API when AI document analysis is enabled`, `Aliyun OSS when attachment upload hooks are enabled`
- `VITE_API_BASE`: required=no, secret=no, source=app/.env or process environment
- `OBSIDIAN_PATH`: required=no, secret=no, source=app/.env or process environment
- `AXI_DOCS_EXTRA_SOURCES_JSON`: required=no, secret=no, source=app/.env or process environment
- `AXI_SKILLS_PATH`: required=no, secret=no, source=app/.env or process environment
- `DBSKILL_PATH`: required=no, secret=no, source=app/.env or process environment
- `BLINKO_URL`: required=no, secret=no, source=app/.env or process environment
- `BLINKO_TOKEN`: required=no, secret=yes, source=app/.env or process environment
- `ANTHROPIC_API_KEY`: required=no, secret=yes, source=app/.env or process environment

## Contracts

- Provides: `Axi Docs web reader`, `axi_docs_* MCP document tools`, `Versioned read-only context and approval-only effect proposals for bounded Agents`, `Knowledge graph and document-source adapters`, `Generated workspace project dossier mirrors`
- Consumes: `Workspace project metadata`, `Locked Axi Skills documentation source`, `Configured Obsidian, Blinko, dbskill, and extra documentation sources`, `task-execution-routing/v1 governance contract`
- Contract files: `docs/project-docs.manifest.json`, `docs/sources.lock.json`, `docs/projects.index.json`, `app/src/config/documentSources.ts`, `app/src/lib/knowledgeBase.ts`, `app/src/mcp/server.ts`, `app/src/mcp/handoffTools.test.ts`

## Current Work

- TODO: `docs/state/TODO.md`
- Milestone: `docs/state/MILESTONE.md`
- Active: Keep the project documentation contract and generated dossier coverage complete.
- Active: Maintain workspace registry coverage and locked documentation sources.
- Active: Continue the VitePress-aligned reader experience and source governance milestone.
- Known failure: TODO.md records remaining security, asynchronous I/O, CORS, architecture, UX, and test-coverage work.
- Known failure: Live Blinko, AI analysis, and OSS integrations require their corresponding external services and credentials.

## Troubleshooting

- Symptom: Governance or documentation checks report missing files.
  Diagnosis: A required root or app governance document was removed, renamed, or not generated.
  Resolution: Run pnpm --dir app docs:check, restore the named file from its authoritative source, and rerun the check.
- Symptom: Source checks report a lock mismatch or unavailable documentation source.
  Diagnosis: A configured external source moved or its locked revision no longer matches the local checkout.
  Resolution: Inspect docs/sources.lock.json and the configured source path, then update the lock only after verifying the intended revision.
- Symptom: The build fails while optional live integrations are unavailable.
  Diagnosis: A source adapter or environment-dependent path is being treated as required during build.
  Resolution: Check app/.env.example and app/AGENTS.md, disable the optional source or provide its documented local configuration, then rerun pnpm --dir app verify.

## Decisions And Freshness

- ADR: `docs/axi-workspace-governance/adr/README.md`
- Changelog: `docs/state/CHANGELOG.md`
- Submit log: `app/docs/logs/submit/`
- Last verified: `2026-08-22`
- Evidence: `The governance documentation gate exited successfully on 2026-06-11.`, `The production build exited successfully on 2026-06-11.`, `Manifest JSON and all declared relative paths were checked on 2026-06-11.`

> Generated from `docs/project-docs.manifest.json`; edit the manifest, then regenerate this file.
