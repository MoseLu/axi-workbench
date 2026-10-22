# Changelog

All notable local changes to `workbench/axi-workbench` are recorded here
in Keep-a-Changelog 1.1 format. Each implementation change should append
an entry to the appropriate `### Added / ### Changed / ### Fixed /
### Removed` subsection under `[Unreleased]`.

> **Canonical detailed log**: [`docs/state/CHANGELOG.md`](docs/state/CHANGELOG.md)
> (per-batch CL entries with evidence pointers — historical source of truth).
>
> **Active work / handoff**: [`HANDOFF.md`](HANDOFF.md) and
> [`docs/HANDOFF.md`](docs/HANDOFF.md).
>
> **Root-level milestone pointer**: [`CHANGE.md`](CHANGE.md).
>
> This root-level file is the working summary that follows the
> Keep-a-Changelog 1.1 schema; `docs/state/CHANGELOG.md` remains the
> canonical (deep) log and is regenerated from this file's `### Added` /
> `### Changed` / `### Fixed` blocks as well as per-batch CL records.

The format is based on [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
via the workspace graph (no per-repo semver tags — see ADR-008 and
`/Volumes/code/workspace/foundation/axi-rules/INDEX.md`).

## [Unreleased]

### Added

- 2026-10-17 — `docs(workbench): expand INDEX.md to full doc-map router
  (P3 b9)` (`30c3b86a`): root `INDEX.md` strengthened from a 28-line
  pointer to a full doc-map router covering ~50 doc files, ~30 absorbed
  apps/services, six subtree `AGENTS.md` boundaries, and the Six-Layer
  operating model. The doc is now the canonical "where do I read or
  update X?" entry point.
- 2026-10-17 — `chore(workbench): Wave G six-stage overview
  (Batch 1/16)` (`3c595a24`): image-asset remediation wave G summary
  appended to `docs/HANDOFF.md`; covers dango-family / illustration
  fallback paths across `apps/workbench` + `apps/workbench-mobile`.
- 2026-10-17 — `chore(workbench): Wave F final summary
  (Batch 1/16)` (`2b4b50a2`): image-asset remediation wave F summary
  appended; closes the remaining hardcoded SVG / PNG fallback gaps.
- 2026-10-16 — `chore(workbench): Wave C image asset documentation
  (Batch 1/16)` (`7a1ac169`): documented image-asset ownership and
  replacement strategy across `apps/workbench` and the dango family.
- 2026-10-16 — `chore(workbench): Wave B image asset optimization
  (Batch 1/16)` (`f92af6e5`) + `Wave B continuation re-dispatch
  (Batch 1/13)` (`56a07f03`): PNG → WebP optimization for ~80 hero /
  illustration assets; re-dispatch covers the UI-shell surface.
- 2026-10-15 — `docs(workbench): flesh out CLAUDE.md from 1-line
  stub` (`beb523f3`): `CLAUDE.md` elevated from a 1-line stub to a
  Claude-Code-specific addendum (per the `axi-rules` AGENTS
  multi-adapter template, before first commit guard).
- 2026-10-15 — `docs(workbench): add root ARCHITECTURE.md (P2-4)`
  (`a8e1b5cd`): high-level architecture narrative anchored on the
  six-layer control plane + absorbed apps topology.
- 2026-10-15 — `docs(workbench): add root CHANGE.md
  (AR-BOOTSTRAP-002)` (`f9e593a4`): root pointer file per
  `axi-rules` AR-BOOTSTRAP-002.1 (root pointer option), pointing at
  `docs/state/CHANGELOG.md` as the canonical detailed log.
- 2026-10-15 — `docs(agents): upgrade partial citation to canonical
  axi-rules INDEX` (`39b776c0`): replaces ad-hoc rule references with
  the canonical `/Volumes/code/workspace/foundation/axi-rules/INDEX.md`.

### Changed

- 2026-10-19 — `chore(hygiene): commit .githooks/ updates (P3 batch 25
  audit hygiene fix)`: `.githooks/post-commit` rewritten in L6-remediation
  form (axi-bypass-audit-resolve first, then submit-log, then
  workspace-change-propagation; all soft-fail with `|| true`); drops the
  `workspace-change-ledger.mjs record` step that no longer exists.
  `.githooks/pre-commit` drops the `--record` flag from
  `workspace-flow preflight` (the L6-bypass-audit resolver now records
  the real SHA during the post-commit phase).
- 2026-10-14 — `fix(workbench): repair devsvc-dashboard, hardcoded
  SVGs, topbar language` (`86c9cab5`) + `make Icon component
  production-build safe` (`d22357eb`): removed hardcoded SVG fallbacks
  from `devsvc-dashboard` Shell + Icon surfaces; localized topbar
  strings (zh-CN default).
- 2026-10-14 — `fix(workbench): repair dark-theme icon visibility
  end-to-end` (`48814b68`) + `raise dark-mode action contrast`
  (`e67f2f35`): dark-theme icon contrast WCAG-aligned; contrast tokens
  for primary/secondary actions audited across all webview apps.
- 2026-10-12 — `chore(workbench): regenerate workspace projections
  for m18 batch` (`38477eee`): post-commit `workspace-project` snapshot
  refresh (governance mirror JSON + `project-handoff.md`).
- 2026-10-11 — `fix(workbench): narrow email code countdown slot`
  (`e1a0b2c3`): tightens the email-code `useCountdown` slot
  arithmetic to fix a race when the user reopens the dialog after
  expiry.
- 2026-10-11 — `fix(workbench): resolve @ant-design/icons contract
  violations` (`85dcfa59`): all `<Icon>` consumers migrated to the
  local `Icon` component surface; `verify-ui-contracts` was failing
  due to alias drift; now passes.
- 2026-10-10 — `fix(workbench): align verify-ui-contracts CSS
  assertions with reality` (`d42dd7e3`) + `update verify-ui-contracts
  paths after Login split` (`fadbfd56`): CSS contract test updated to
  reflect Login split + Module split; suite moved from 6 failures to
  green on `apps/devsvc-dashboard`.

### Fixed

- 2026-10-22 — `fix(devsvc-dashboard): repair pre-rename workspace
  partition paths`: four live sites still resolved under
  `projects/axi-workbench`, a path the 2026-10-17 partition move
  removed. `loadWorkspaceResourceRegistry` silently lost 11 static
  overrides because `readJson` fell back to an empty list —
  measured against the live workspace root, the old default resolved
  to 43 resources with 0 static-only entries, the new one to 54 with
  11. Corrected `staticResourcesPath` and `getPersistentCacheDir` to
  `workbench/`, and the eight `cwd` defaults in `axi-app-host.mjs`
  (plus `loadAxiAppRegistry` and the matching `axi-apps.json`
  entries) to their real partitions — `axi-agent` is under
  `agent-cluster/`, `axi-image-preview` under `workbench/`, so neither
  was blanket-copied. `verification-persistence.test.mjs` asserted
  the old path and was updated to match.

- 2026-10-16 — `fix(workbench): Wave A 图片资源整改 (Batch 1/16)`
  (`24cf2539`): image-asset Wave A — replaces 42 broken `<img>`
  references across `apps/workbench` and the dango family; reduces
  404s on `/dango/*.png` to zero.
- 2026-10-13 — `refactor(devsvc-dashboard): split Shell.tsx
  (501 lines) into modules` (`55476d35`) + `docs(devsvc-dashboard):
  point AGENTS.md at the split shell entry` (`88fc611e`): Shell
  module surface now navigable from `apps/devsvc-dashboard/AGENTS.md`;
  verify-ui-contracts passes.
- 2026-10-12 — `refactor(resource-gateway): split server.ts into
  focused modules` (`bbad8099`): `services/resource-gateway/server.ts`
  reduced from ~1,200 lines to 4 modules (`server.ts` 312 lines +
  `routes/*.ts` + `healthz.ts` + `auth.ts`).
- 2026-10-11 — `refactor(workbench): complete MainLayout split
  (596 lines)` (`b022bfef`) + `complete SystemSettingsPanel split
  (625 lines)` (`56d3c619`): two W1 partial splits executed end-to-end.
- 2026-10-10 — `refactor(workbench): complete W1 partial splits
  (app-search + docs kb)` (`eb325bcf`) + `split Login.tsx (1377
  lines) into sub-components` (`5641d57d`): W1 refactor batch lands
  on `dev`.
- 2026-10-09 — `docs(workbench): refresh AGENTS.md oversized-file
  facts` (`08dabd14`) + `add AGENTS.md to 8 key sub-projects (index
  clarity)` (`ab293f16`): sub-project AGENTS bring-up (apps +
  services + packages + tools + prompts + ai); root AGENTS line-count
  facts refreshed.

### Deprecated

- None in this window.

### Removed

- None in this window.

### Security

- 2026-10-04 — SECURITY batches CRITICAL / HIGH+MODERATE / MIXED A/B/C/D
  landed (`baaad801`, `067850f5`, `4e8878b7`, `609a9278`, `9175d78c`,
  `35b46455`): `pnpm audit` reduced from 395 inflated Dependabot
  reports to 41 real advisories; 40/41 resolved (vitest
  1.6.1 → 3.2.7, fast-uri 3.1.6 → ^3.1.8, undici via vitest@4 →
  jsdom, brace-expansion, postcss, @opentelemetry/*, sharp,
  protobufjs, xlsx → @e965/xlsx fork). One accepted-risk remaining:
  `braces 3.0.3` (build-time only, awaiting upstream 3.x patch).
  Full per-batch evidence in `docs/state/CHANGELOG.md` §[Unreleased]
  2026-10-04 WFB-SEC-PNPM-AUDIT entry.

### Fixed

- 2026-10-22: `backend/mini_agent/config/config.yaml` - the MiniMax `api_key`
  was a hardcoded literal that had already been pushed to `origin/dev`. It is
  now the `${MINIMAX_API_KEY}` placeholder, resolved by `Config.from_yaml`
  through the new `resolve_env_placeholder()`. An unset or empty
  `MINIMAX_API_KEY` now raises a `ValueError` naming the variable, the
  `export` command and the owner-managed value source, instead of passing a
  literal `${MINIMAX_API_KEY}` string or an empty value to the API. Key values
  are stored by the owner in `/Users/mose/credentials/api-keys.env`, outside
  this repository. The leaked key must be rotated in the MiniMax console;
  git history still contains the old value.

## Notes for contributors

- Update this file in the same commit as the source change. The
  `[Unreleased]` section is the working buffer; per-batch retroactive
  migrations copy entries into dated sub-versions on release.
- Authoring rules:
  - One bullet per atomic behavior change.
  - Group by Keep-a-Changelog type (`Added / Changed / Fixed /
    Deprecated / Removed / Security`); do not invent new categories.
  - Cite the git short SHA in parentheses at the end of the bullet;
    `docs/state/CHANGELOG.md` may carry the full evidence chain
    (link to commit, file paths, test counts).
  - When a CL entry already lives in `docs/state/CHANGELOG.md`,
    copy the headline summary here and add the SHA pointer; do not
    duplicate the entire body.
- This root-level `CHANGELOG.md` was added on 2026-10-18 as part of
  the P3 docs audit gap remediation (batch 11). It is intentionally
  distinct from `docs/state/CHANGELOG.md` to give a Keep-a-Changelog
  shaped entry point at the repository root; the deeper per-batch
  history remains canonical there.
