# TODO

Tasks are grouped by inferred requirements. P0/P1 items include test cases and reference the
`REQ-*` IDs in `docs/state/PRD.md` and the verification commands in `docs/state/TDD.md`.

## P0

- [ ] REQ-DOC-001: Keep the root documentation suite complete and current.
  - Test: verify `README.md README.zh-CN.md AGENTS.md INDEX.md CHANGE.md docs/state/CHANGELOG.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/PRD.md docs/state/TDD.md docs/state/VERIFICATION.md` exist in `/Volumes/code/workspace/projects/axi-workbench`.
  - Test: `rg -n "REQ-DOC-001|REQ-VERIFY|REQ-BOUNDARY|PRD|TDD|Milestone" docs/state/PRD.md docs/state/TDD.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/CHANGELOG.md` returns hits for every linked REQ.

- [ ] REQ-VERIFY-002: Keep both user-app UI contract verifiers, type-checks, tests, and builds green.
  - Test: Web: `pnpm --filter @axi/workbench type-check`, `test`, `build`, `node apps/workbench/scripts/verify-ui-contracts.mjs`; mobile: `pnpm --filter @axi/workbench-mobile type-check`, `test`, `build`, `verify:contracts`; foundation: `pnpm --filter @axi/workbench-foundation type-check` all exit 0.

- [ ] REQ-CONTROLPLANE-001: Keep the control-plane smoke and six-layer snapshot green.
  - Test: `pnpm --filter @axi/workstation-control-plane smoke` exits 0 and reports ≥ 35 resources across the six layers.

- [ ] REQ-BOUNDARY-001: Preserve ownership and cross-project boundaries.
  - Test: `pnpm check:boundaries` exits 0; `docs/rules/axi-workbench-boundary-sop.md` and `scripts/check-workbench-boundaries.mjs` remain in sync; `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate` reports ok.

- [ ] REQ-WORKBENCH-001: Keep exactly two formal user applications in `apps/`: Web admin and mobile.
  - Test: `apps/workbench` and `apps/workbench-mobile` both exist; `apps/web-portal` is absent or archived; PRD/TDD/CHANGELOG state that neither app is a viewport branch of the other.

## P1

- [ ] REQ-VERIFY-001: Keep verification commands accurate for the real project stack.
  - Test: every command listed in `TDD.md` runs against the current monorepo or the blocker is recorded in `docs/state/CHANGELOG.md`.

- [ ] REQ-BOUNDARY-002: Service contracts declare six-layer paths before merge.
  - Test: every modified service under `services/` has its `entry / authority / downstream / renderer / audit / verification` declared in the PR description and verified against `docs/rules/epap-six-layer-sop.md`.

- [ ] REQ-COMMUNICATION-001: Keep communication-gateway above business logic.
  - Test: `pnpm --filter @axi/workstation-communication-gateway test` passes and the gateway source does not import Codex, workspace index, memory tables, or project state owners.

- [ ] REQ-WORKBENCH-002: Keep Web / mobile rendering boundaries clean.
  - Test: 1440px Web smoke renders Axi Dashboard chrome at `:5173`; 390px mobile-app smoke renders the 微信式居中顶栏、加号菜单、五项绿色底栏与扫码入口 at `:5174`; both app-specific contract verifiers pass and neither app imports the other app’s implementation.

- [ ] REQ-DOC-002: Keep the v2 zero-context manifest current.
  - Test: `docs/project-docs.manifest.json` parses as JSON, references only project-local files, contains no secret values, and reflects the latest entrypoints, contracts, and verification evidence.

- [ ] REQ-AXI-CODER-001: Keep Axi Coder snapshots free of hard-coded neighbor paths.
  - Test: no Axi Coder snapshot contains a hard-coded `/projects/axi-notify/...` artifact path; resolution goes through environment variables and `workspace://` contract references.

- [ ] REQ-MOBILE-001: Keep the independent WeChat-style mobile app and its shared foundation auditable.
  - Test: `apps/workbench-mobile` owns its overview/project/workspace/scan/me routes, centered header, five-tab bar, badges and scan page; `packages/workbench-foundation` lists shared session / locale keys; mobile theme switching round-trips through `axi.workbench.mobile.theme.mode` without importing Web layout code.

- [ ] REQ-MILESTONE-001: Update `MILESTONE.md` after each verified delivery batch.
  - Test: each `docs/logs/submit/<batch-id>.md` is cited in the latest MILESTONE entry, and the linked deliverable evidence is current.

## P2

- [ ] REQ-LOG-001: Promote submit-log discipline to P0 once weekly cadence stabilizes.
  - Test: every merged batch has both `docs/logs/submit/<batch-id>.md` and a matching `CHANGELOG.md` entry; missing entries are listed by `pnpm check:boundaries` (when extended).

## Zero-context handoff governance

### Completed — Migrate the project docs manifest to v2

- **Problem:** The v1 manifest listed documents but did not expose the workbench's real entrypoints, six-layer contracts, runtime commands, environment dependencies, active milestone, or fresh smoke evidence.
- **Solution:** Upgrade `docs/project-docs.manifest.json` to version 2 from repository-local guidance, package scripts, control-plane sources, workspace packages, TODOs, milestone, and docs SOPs.
- **Expected result:** A zero-context agent can enter the canonical workbench, select the correct layer and entrypoint, run the smallest safe command, and identify contract and ownership boundaries without broad rediscovery.
- **Acceptance:** The manifest contains every v2 onboarding field, parses as JSON, points only to project-local files, contains no secret values, and marks the project verified only after a safe smoke succeeds.
- **Evidence:** `docs/project-docs.manifest.json`; `pnpm --filter @axi/workstation-control-plane smoke` exited 0 with a 35-resource six-layer snapshot on 2026-06-11.
- **Dependencies:** `AGENTS.md`, `README.md`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/epap-project-doc-agent-sop.md`, package manifests, and control-plane sources.
- **Status:** Completed on 2026-06-11.

### Completed — Refresh PRD/TDD/CHANGELOG/MILESTONE for the v2 workbench (2026-08-07)

- **Problem:** The previous `PRD.md` and `TDD.md` were sparse (3 and 4 requirements respectively) and did not yet list the new `REQ-*` families covering Workbench UI contracts, control plane, communication gateway, mobile shell, workbench entrypoint consolidation, Axi Coder snapshot contract, and delivery-state/log governance. The TODOs and delivery-state record lagged behind.
- **Solution:** Rewrite `docs/state/PRD.md` with 13 `REQ-*` rows mapped to acceptance criteria and success metrics; rewrite `docs/state/TDD.md` with per-surface verification commands and explicit risk cases; re-tag `docs/state/TODO.md` tasks by `REQ-*`; refresh `docs/state/MILESTONE.md` evidence; add a CHANGELOG entry.
- **Expected result:** Every PRD requirement is traceable to a TDD command and a TODO test case, and the delivery evidence matches the latest verified smoke.
- **Acceptance:** `rg -n "REQ-(DOC|VERIFY|BOUNDARY|CONTROLPLANE|COMMUNICATION|WORKBENCH|MILESTONE|LOG|AXI-CODER|MOBILE)" docs/state/PRD.md docs/state/TDD.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/CHANGELOG.md` returns hits for every REQ.
- **Evidence:** `docs/state/PRD.md`, `docs/state/TDD.md`, `docs/state/TODO.md`, `docs/state/MILESTONE.md`, `docs/state/CHANGELOG.md` updated on 2026-08-07.
- **Dependencies:** `AGENTS.md`, `README.md`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/axi-workbench-boundary-sop.md`, `docs/project-docs.manifest.json`.
- **Status:** Completed on 2026-08-07.

### Ongoing — Keep zero-context evidence fresh

- **Problem:** Monorepo package moves, new dashboard apps, service contracts, environment variables, and six-layer ownership changes can make onboarding facts stale quickly.
- **Solution:** Update the v2 manifest whenever entrypoints, package scripts, contracts, required services, ownership, TODO priorities, milestone, or verification behavior changes.
- **Expected result:** Future agents can use one current manifest to choose the correct subtree guidance and verification lane.
- **Acceptance:** Each relevant change updates `updated`, `currentWork`, `contracts`, and `verification`; verified status requires a fresh safe smoke; TODO, milestone, and changelog remain consistent.
- **Evidence:** Fresh smoke output in `verification.evidence`, JSON/path checks, and a matching `CHANGELOG.md` entry.
- **Dependencies:** Owners of `apps/`, `services/`, `packages/`, `ai/`, `infra/`, `prompts/`, and `tools/`.
- **Status:** Ongoing.
