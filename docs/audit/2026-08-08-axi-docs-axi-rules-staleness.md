# Audit: Axi Docs & Axi Rules staleness relative to active projects

- Date: 2026-08-08
- Status: informational, no remediation committed
- Sources:
  - `workspace-project list` (`/Volumes/code/workspace/scripts/workspace-project`)
  - `workspace-project handoff-check` for `axi-docs` and `axi-rules`
  - filesystem mtimes under `projects/axi-docs/docs/content/{en,zh}/projects/`
  - filesystem mtimes under `projects/axi-rules/index/*.json` and `rules/*/`
  - `git log --format=%as -1` for each project's HEAD commit

## Headline numbers

- 35 projects registered in `workspace-project` graph; all 35 paths exist on
  disk (no dangling registration).
- `axi-docs` lastVerifiedAt = 2026-06-18 (50 days ago) — stale by handoff
  policy (>30d max). Errors: "readOrder must contain at most 5 item(s)",
  "verification is stale".
- `axi-rules` lastVerifiedAt = 2026-06-11 (57 days ago) — stale by handoff
  policy. No structural errors but freshness is gone.
- 31 dossier mirrors under `projects/axi-docs/docs/content/{en,zh}/projects/`.
  Only `axi-workbench` (2026-08-07 this session) and `story-graph`
  (2026-08-07 this session) carry an August 2026 mtime. The other 29
  mirrors sit at June/July 2026 and likely describe pre-v3 workbench and
  pre-Go-advisory service state.

## Three risk surfaces the user asked about

### 1. Docs surface: dossier freshness vs project commit cadence

A side-by-side of `last commit date (per project HEAD)` against
`lastVerifiedAt`:

| Project         | last commit | lastVerifiedAt | lag (days) |
|-----------------|-------------|----------------|------------|
| axi-workbench   | 2026-08-08  | 2026-08-07     | 1          |
| axi-image-preview | 2026-07-22 | 2026-07-22   | 0          |
| axi-notify      | 2026-07-29  | (no entry)     | 41+        |
| axi-pet-desktop | 2026-08-03  | (no entry)     | 36+        |
| axi-agent-platform | 2026-07-22 | 2026-06-18   | 34         |
| axi-pet         | 2026-06-18  | 2026-06-11     | 7          |
| axi-docs        | 2026-08-07  | 2026-06-18     | 50         |
| axi-rules       | 2026-07-28  | 2026-06-11     | 47         |

Pattern: projects with lastVerifiedAt are stale or empty; the most
recently-changed projects (`axi-pet-desktop`, `axi-notify`) have no
verification row at all. The dossier reflects only projects that
re-registered after a governance change, not the steady-state of
active work.

### 2. Rules surface: documentation drift between rules and active
   state

`axi-rules` ships 50 `AR-*` rules across 13 modules
(`rules/{agent-routing,cicd,codex-tooling,development-sop,
git-automation,handoff,lifecycle,memory,project-bootstrap,
project-display,safety,verification}`). The `rules.json` index is
mtime 2026-07-28; the highest activity since then is in workbench
(dual-app v3, six-layer verification, pnpm.overrides, Go service
advisories). The rule docs that should reflect this:

- `rules/lifecycle/AGENTS.md`: does not yet mention dual-application
  workbench (apps/workbench + apps/workbench-mobile + foundation
  package). Any agent that picks workbench next via routing rules
  would receive pre-v3 guidance.
- `rules/project-bootstrap/AGENTS.md`: references
  `AR-BOOTSTRAP-AFTER-001` which points at `WORKSPACE_INDEX.md`, but
  the rule itself predates the absorb-of-app-search-system and
  axi-notify-mobile decisions. New framework events (the dual-app
  split, the foundation-package reuse, the dependabot override
  pattern) are not encoded as rules yet.
- `rules/verification/AGENTS.md`: tool does not yet capture the
  `pnpm.overrides` patch handoff, the dual-lane workbench UI
  contract verifier, or the sub-pnpm-lock rewrite pattern used in
  this session.
- `rules/handoff/AGENTS.md`: does not yet call out the new
  `apps/app-search-system/` ownership decision
  (`docs/audit/2026-08-08-apps-app-search-system-ownership-decision.md`)
  or the apps/app-search-system -> apps/workbench-mobile mobile
  shell duality.

### 3. Graph surface: rules/projects.json vs workspace-project list

`axi-rules/index/projects.json` carries 30 entries.
`workspace-project list` carries 35. The drift:

- **In workspace registry, missing from rules/index** (9 projects):
  - `ai-capability`, `axi-accounts`, `axi-coder`, `axi-model-gateway`,
    `codex-app-projects`, `minimax-tokenplan`, `ollama-local`,
    `sports-management`, `story-graph`.
- **In rules/index, missing from workspace registry** (4 projects):
  - `agents-multi`, `axi-pet-renderer`, `axi-sports-management-app`,
    `codex-plus-app`.

In other words: rules-side misses 9 active projects, while carrying
4 stale entries for projects that no longer register. Cross-cutting
governance commands (`workspace-project deps / consumers / profile`)
that lean on rules-side indexes will mis-report for these projects.

## Recommended remediation order (not committed in this audit)

1. Re-run `axi-rules/scripts/* generate-index` (the regeneration
   tooling internal to `axi-rules`) so `index/projects.json` matches
   the current `workspace.json` snapshot. That alone closes 9 of the
   13 entries.
2. Manual stale-eviction for `agents-multi`, `axi-pet-renderer`,
   `axi-sports-management-app`, `codex-plus-app` in rules/index.
3. Refresh `axi-docs`'s dossier for at least `axi-rules`,
   `axi-pet-desktop`, `axi-notify-mobile`, `axi-agent-platform`,
   `axi-pet`, `story-graph` with their v3-era summaries. Today only
   `axi-workbench` + `story-graph` were updated; the others still
   describe pre-2026-06 state.
4. Bump `axi-rules/rules/{lifecycle,verification,handoff}` AGENTS.md
   to record the v3 dual-app workbench, the pnpm.overrides patch
   pipeline, and the new home for `apps/app-search-system/`.
5. Re-run `workspace-project handoff-check` on both `axi-docs` and
   `axi-rules` so their `lastVerifiedAt` advances past 30 days; both
   currently read as `stale` and that propagates to the default
   `proceed via readOrder 5-item cap` requirement.

## Evidence reused from this session

- `docs/logs/handoff/2026-08-08-axi-docs-deps-handoff.md`
- `docs/audit/2026-08-08-apps-app-search-system-ownership-decision.md`
- `docs/state/PRD.md` and `docs/state/TDD.md` (workbench v3 dual-app)
- `docs/project-docs.manifest.json` (the v2 zero-context manifest)

## What this audit does NOT do

- No source code change in any of the 35 projects.
- No `pnpm install`, `git mv`, or cross-project migration is run.
- No `workspace-project` mutation, no governance PR.
- No commit lands in `axi-rules`, `axi-docs`, or any sibling repo.

Re-running this audit (after the recommended steps 1-5) should drop
the open staleness flags to zero and bring the dossier mtimes inside
the 30-day window.
