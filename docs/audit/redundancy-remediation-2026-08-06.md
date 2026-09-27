# Redundancy remediation — 2026-08-06

## Goal

Reduce dual-portal / dual-shell / dead-package confusion inside Axi Workbench
and clear empty workspace stubs that were never registered projects.

## Done in this pass

### axi-workbench

1. **Archived** `packages/web` → `archive/legacy-packages-web`  
   - Collision: package name was `web-portal`, so turbo `--filter=web-portal` preferred the clone over `@epap/web-portal`.
2. **Archived** `packages/desktop` → `archive/legacy-packages-desktop`  
   - Superseded by `apps/axi-coder` + `@axi/*`.
3. **Fixed root scripts**
   - `dev:web` / `build:web` → `--filter=@epap/web-portal`
   - Removed `dev:desktop` (legacy package gone)
   - Added `dev:dashboard`, `dev:coder` for the real host surfaces
4. **Marked** `packages/ui` legacy (`LEGACY.md` + package description)
5. **Documented** ownership in `apps/AGENTS.md` and `packages/AGENTS.md`

### Workspace (outside monorepo git)

1. Moved empty `projects/axi-pet-renderer` → `references/archives/axi-pet-renderer-empty-2026-08-06`
2. Moved stub `projects/agents-multi` → `references/archives/agents-multi-stub-2026-08-06`
3. Added `tools/codex-plus-app/DEPRECATED.md` (already a non-entrypoint)

## Explicitly not done (deferred)

| Item | Reason |
|------|--------|
| Migrate web-portal off `@epap/ui` to `@axi/*` | Large product change; portal still needs layout |
| Delete photo-sort samples/tools under `shared/` | Data assets; owner may still use offline |
| Remove dual `stage-tamagotchi` under pet repos | Needs pet-desktop owner pass |
| Rewrite `docs/03-frontend.md` EPAP blueprint | Separate docs hygiene |
| Delete incubator MVP | Valid non-project incubation |

## Verification commands

```bash
cd /Volumes/code/workspace/projects/axi-workbench
pnpm install
pnpm check:boundaries
pnpm --filter @epap/web-portal type-check
pnpm --dir apps/devsvc-dashboard typecheck
# filter must resolve ONLY apps/web-portal:
pnpm -r list --depth -1 | grep -E 'web-portal|desktop'
```

Expected after install: package list includes `@epap/web-portal` under `apps/web-portal`;
does **not** list `web-portal@` from `packages/web` or `desktop@` from `packages/desktop`.
