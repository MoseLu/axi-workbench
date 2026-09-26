# Axi Workbench CHANGELOG stub

> This root file is a **builder-friendly stub**. The canonical changelog
> lives at [`docs/state/CHANGELOG.md`](./docs/state/CHANGELOG.md) and tracks
> every user-visible, operator-visible, or downstream-agent-visible change.

Latest batch (2026-08-07) carries 14 commits: archive legacy packages,
refresh `pnpm-lock.yaml`, rebrand `apps/web-portal` into the single SPA
`apps/workbench`, add `apps/workbench-mobile`, expand services + dashboard
host + Axi Coder contracts, align `@axi/workstation-contracts`, and refresh
PRD/TDD/TODO/MILESTONE/CHANGELOG to v3 (two independent workbench apps).

- Canonical source: [`docs/state/CHANGELOG.md`](./docs/state/CHANGELOG.md)
- Last refreshed: 2026-08-07

---

## [Unreleased] - Commit Ledger (2026-09-15)

### Added
- Git commit collector + evidence linker + ingestion modules (`services/control-plane/src/commit-ledger/`)
- JSON Schema for commit ledger records (`packages/commit-ledger-schema/schema.json`)
- 7 read-only API routes (summary, commits, commits/:id, projects/:id, verification, sources, sync) in `api-routes.mjs` + `api-handlers.ts`
- Operations/Commit Ledger web page (`apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx`) + `useCommitLedger.ts` hook
- Gateway proxy routes with `RequireIdentity` (`services/api-gateway/config/routes.yaml:301-363`)
- OpenAPI spec (`services/control-plane/openapi/commit-ledger.v1.yaml`)
- Web route registration (`apps/workbench/src/lib/navigationRegistry.ts:82,133`)

### Local verification
- Persistence/idempotency/conflict/stale tests: `persistence.test.ts` PASS
- Integration test scaffold: `integration.test.ts` exists (execution pending)

### Package consumption (WFB-PACK-001, 2026-09-15)
- Recorded `@axi/*` provider versions, Verdaccio registry source (`http://127.0.0.1:4873/`) and peer-dependency contract in [`apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md`](./apps/devsvc-dashboard/docs/PACKAGE-CONSUMPTION.md).
- Added `apps/devsvc-dashboard/scripts/scan-runtime-paths.mjs` plus a 6-case `node --test` suite that detects `/Volumes/code/workspace/...` references inside built artifacts, allowlists governance snapshot files, and is invoked against the real `apps/devsvc-dashboard/dist` (currently clean).
- Audited Axi Coder, Agent Platform frontend, and the Web/Mobile/Desktop distributions; consumers without a top-level `@axi/*` reference are explicitly logged as blocked in the consumption doc.

### Workspace relation audit (WFB-GOV-001, 2026-09-15)
- Captured the canonical-remote vs graph-`repo` table for all 40 graph projects and reconciled against `infra/axi-workspace-governance/workspace.json` plus `.workspace/registry.json`.
- Ran `workspace-project deps` and `workspace-project consumers` for `axi-ui`, `axi-registry`, `axi-workspace-governance`, `axi-rules`, `axi-docs`, `axi-skills`, `axi-tauri-starter`: **28 / 28 forward + reverse edges match with zero drift**.

### Resource Index metadata wiring (WFB-REG-002, 2026-09-15)
- Populated real, source-anchored metadata for the four canonical Resource Index resources in [`config/axi-resources.json`](./apps/devsvc-dashboard/config/axi-resources.json):
  - `axi-rules.rulesMetadata` — `ruleFamilies` derived from `projects/axi-rules/index/rules.json` (14 categories), `applicableScopes` covering project/workspace/system/shared-package, `sourcePrecedence` mirrored 1:1 from `index/sources.json` rank order.
  - `axi-skills.skillsMetadata` — `skillCategories` (10 functional groups), `version` parsed from `shared/axi-skills/apm.yml` (`0.1.0`), `i18nStatus` derived from `skills/` vs `skills.zh/` SKILL.md parity (`partial`), `skillCount` matches the real filesystem count (879).
  - `axi-registry.registryMetadata` — `registryUrl` parsed from `infra/axi-registry/config/config.yaml` (`http://127.0.0.1:4873`), `healthEndpoint` extracted from `scripts/health.mjs`, `packageCount` counted from `storage/@axi/*` directories (4), `healthStatus` set to `unknown` reflecting the current state (`curl :4873` fails).
  - `axi-workspace-governance.governanceMetadata` — `projectCount` matched against `.workspace/registry.json` (22), `graphValidation` reflects the last `pnpm workspace:audit` result (0 errors / 0 warnings), `lastValidatedAt` taken from the governance registry's `generatedAt`.
- Added `apps/devsvc-dashboard/scripts/resource-metadata.test.mjs` (18 assertions, pure Node `node:test` + disk reads) that re-derives every anchor from the underlying repos so future drift surfaces immediately. **`pnpm --dir apps/devsvc-dashboard test` → 102/102 PASS; typecheck → 0 errors.**
- Confirmed three Workbench distributions are now built via apps/workbench, apps/workbench-mobile, apps/workbench-desktop inside this monorepo (commit 6bf7d674 WFB-BASE-MERGE brings web equivalent; mobile/desktop distribution CI is being staged)
- Full audit report (canonical remote vs graph repo, graph-only registration matrix, provider forward/reverse audit, discrepancy classification) lives at [`docs/specs/2026-09-14-workspace-foundation-binding/WORKSPACE-RELATION-AUDIT_2026-09-15.md`](./docs/specs/2026-09-14-workspace-foundation-binding/WORKSPACE-RELATION-AUDIT_2026-09-15.md).

### Drift-check wrapper (WFB-DRIFT-001, 2026-09-15)
- Added `pnpm drift-check` to [`apps/devsvc-dashboard/package.json`](./apps/devsvc-dashboard/package.json) so developers no longer have to memorise `node scripts/drift-check.mjs /Volumes/code/workspace`.
- Rewrote [`apps/devsvc-dashboard/scripts/drift-check.mjs`](./apps/devsvc-dashboard/scripts/drift-check.mjs) with `resolveWorkspaceRoot()` that prefers explicit `argv[2]`, then `WORKSPACE_ROOT` env, then walks up to find `workspace.graph.json` (fixing the previous 4-up fallback that only reached `/Volumes/code/workspace/projects`).
- The script now prints `0 warnings, 0 errors` and `✅ No drift detected` on success, and emits `ERROR: workspace.graph.json not found at <path>` plus a `Hint:` instructing the developer how to set the workspace root when the graph is missing.
- Added [`apps/devsvc-dashboard/scripts/drift-check.test.mjs`](./apps/devsvc-dashboard/scripts/drift-check.test.mjs) covering the default entry point (exit 0, `0 warnings, 0 errors`), auto-located workspace root, explicit workspace argument, `WORKSPACE_ROOT` env variable, missing-graph error path (exit 1 + `Hint:`), and the `menuGroup` warning branch.
- `node --test scripts/drift-check.test.mjs` is 7/7 PASS across repeated runs; `pnpm drift-check` from any cwd exits 0 with `Workspace Root: /Volumes/code/workspace`.

### External gates
- Production DB migration: BLOCKED
- Production deploy: BLOCKED
- Public OIDC: BLOCKED

Status: **partial** — local integration complete, CL-018 execution + CL-020 final review pending.
