# Audit: should `apps/app-search-system/` be migrated out of workbench?

- Date: 2026-08-08
- Author: workbench maintainer (this session's decision log)
- Sources: `apps/app-search-system/AGENTS.md`, `apps/app-search-system/CLAUDE.md`,
  `/Volumes/code/workspace/WORKSPACE_INDEX.md`, and the dependency handoff
  note from `docs/logs/handoff/2026-08-08-axi-docs-deps-handoff.md`

## Question

After the dependabot fix batch closed the workbench-side fraction of the
alerts, 39 open alerts remained, all under
`apps/app-search-system/frontend/{control,display}/`. These belong to
the SOP / Docs / Capacitor / Electron product subtree - which on first
glance looks more axi-docs-shaped than workbench-shaped. The natural
follow-up question is whether `apps/app-search-system/` should physically
migrate into `projects/axi-docs/apps/`.

## Verdict

**No - keep `apps/app-search-system/` inside the workbench repo.**

## Why

1. **Workspace governance already absorbed it.**
   `/Volumes/code/workspace/WORKSPACE_INDEX.md` records the row:
   > Absorbed former standalone roots `axi-workstation`,
   > `axi-devsvc-dashboard`, `axi-coder`, `axi-verification-inbox`,
   > `app-search-system`, `axi-ollama-menu-assistant`,
   > `infra/fleet-console`, and `tools/axi-app-cli`.

   And then in the "Removed Axi standalone roots" table:
   > `/Volumes/code/workspace/projects/app-search-system` - removed

   Translation: the project owner once intended the SOP system to live
   as a sibling root, then folded it into the workbench monorepo on
   purpose. The current placement is the owner's intent.

2. **Cross-project migration cost.**
   `find apps/app-search-system -type f -not -path '*node_modules*' \
     -not -path '*dist*'` reports 2,154 files. Those include the
   Capacitor Android project (`apps/app-search-system/frontend/display/android/`),
   Electron Control and Display builder configs, and a Flask backend
   on port 8765. Moving all of that across the workspace boundary
   needs a coordinated PR pair: removing from workbench and adding to
   axi-docs. That coordination falls outside this session's scope.

3. **A smaller remediation exists inside workbench.**
   The 39 alerts are npm transitive advisories (electron, fast-uri,
   ip-address, brace-expansion, js-yaml, undici, hono, etc.). The
   pnpm-overrides recipe that closed the workbench-side fraction
   (`docs/logs/handoff/2026-08-08-axi-docs-deps-handoff.md`) can be
   applied directly to `apps/app-search-system/frontend/{control,display}/`
   - keeping the subtree in place but resolving the alerts. This is
   much cheaper than migration.

4. **Documentation ownership is already explicit.**
   `apps/AGENTS.md` lists `app-search-system/` as one of the seven
   "Dashboard Apps" of workbench. `apps/app-search-system/AGENTS.md`
   itself describes the subtree ("SOP 系统") without claiming any
   cross-project migration. The workbench AGENTS.md "Project
   Boundary" table does not carve out app-search-system from the
   workbench scope, only `references/*` and
   `infra/axi-workspace-governance/` are excluded.

## What to do instead

- Apply the pnpm-overrides recipe documented in
  `docs/logs/handoff/2026-08-08-axi-docs-deps-handoff.md` to the
  app-search-system manifests inside workbench. This is permitted by
  `apps/app-search-system/AGENTS.md` and does not require any
  cross-project ceremony.
- If the deeper relocation is still desired, raise a workspace
  governance issue (`/Volumes/code/workspace/projects/axi-rules`)
  and let workspace governance drive the migration. Cross-project
  moves that change the workspace graph should not originate as a
  hot patch.

## Evidence reused

- `apps/app-search-system/AGENTS.md` (L2 SOP system)
- `apps/app-search-system/CLAUDE.md` (Backend Python / Frontend
  Capacitor + Electron)
- `apps/AGENTS.md` (workbench subtree list including app-search-system)
- `WORKSPACE_INDEX.md` (Absorbed roots list, Removed Axi standalone roots)
- `docs/logs/handoff/2026-08-08-axi-docs-deps-handoff.md`
