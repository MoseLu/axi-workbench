# TODO

Tasks are grouped by inferred requirements. P0/P1 items include test cases and reference the
`REQ-*` IDs in `docs/state/PRD.md` and the verification commands in `docs/state/TDD.md`.

## P0

- [x] REQ-DOC-001: Keep the root documentation suite complete and current.
  - Test: verify `README.md README.zh-CN.md AGENTS.md INDEX.md CHANGE.md docs/state/CHANGELOG.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/PRD.md docs/state/TDD.md docs/state/VERIFICATION.md` exist in `/Volumes/code/workspace/projects/axi-workbench`.
  - Test: `rg -n "REQ-(POSITION|ARCH|ACTION|REFERENCE|SURFACE|WEB|MOBILE|CROSS|SCAN|DELIVERY|DOC|VERIFY|BOUNDARY|CONTROLPLANE|COMMUNICATION|WORKBENCH|MILESTONE|LOG|AXI-CODER)" docs/state/PRD.md docs/state/TDD.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/CHANGELOG.md` returns hits for every linked REQ.

- [x] REQ-POSITION-001 / REQ-ARCH-001 / REQ-ACTION-001 / REQ-SURFACE-001: Create a capability, route and action-policy ownership inventory before the next user-facing implementation batch.
  - Test: every existing and proposed user-facing capability follows `docs/specs/<change-id>/CAPABILITY-OWNERSHIP.md` and identifies its task role, A/B/C/D action level, execution-surface Owner (Web control center / Mobile role execution / actual vertical tool), any separate Host/discovery entry, allowed action, server-side policy/authority, audit/handoff association, acceptance, reviewer, and reason it is not duplicated on another surface.

- [x] REQ-REFERENCE-001: Keep external multi-end references bounded and traceable during design review.
  - Test: `MARKET-REFERENCE.md` links each public observation to an official source, labels the product inference, and states what the source does not prove about Workbench or the reference product's internal implementation.

- [x] REQ-SCAN-001: Keep only controlled mobile/identity scan flows and exclude a generic Web scanner.
  - Test: Mobile "审批扫码确认" and Identity "确认网页登录" have separate permission expectations, URI/API contracts, audit assertions and failure messages; the top Scan action does not silently absorb identity-login or device-pairing flows, and the Web verifier rejects a generic scanner or navigation entry.

- [x] REQ-VERIFY-002: Keep both user-app UI contract verifiers, type-checks, tests, and builds green.
  - Test: Web: `pnpm --filter @axi/workbench type-check`, `test`, `build`, `node apps/workbench/scripts/verify-ui-contracts.mjs`; mobile: `pnpm --filter @axi/workbench-mobile type-check`, `test`, `build`, `verify:contracts`; foundation: `pnpm --filter @axi/workbench-foundation type-check` all exit 0.

- [x] REQ-CONTROLPLANE-001: Keep the control-plane smoke and six-layer snapshot green.
  - Test: `pnpm --filter @axi/workstation-control-plane test` and `smoke` exit 0; the regression suite covers production rejection of a missing or development-default gateway internal token, Registry/Graph-only optional resource paths, and complete-field normalization for persisted evidence, and smoke reports ≥ 35 resources across the six layers.

- [x] REQ-BOUNDARY-001: Preserve ownership and cross-project boundaries.
  - Test: `pnpm check:boundaries` exits 0; `docs/rules/axi-workbench-boundary-sop.md` and `scripts/check-workbench-boundaries.mjs` remain in sync; `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate` reports ok.

- [x] REQ-WORKBENCH-001: Keep exactly two formal user applications in `apps/`: Web admin and mobile.
  - Test: `apps/workbench` and `apps/workbench-mobile` both exist; `apps/web-portal` is absent or archived; PRD/TDD/CHANGELOG state that neither app is a viewport branch of the other.

- [x] REQ-WEB-001 / REQ-WEB-002: Define and implement the desktop-first Web management information architecture.
  - Test: browser review at desktop width covers global overview, cross-project filtering, complex configuration, audit/history and batch actions without mobile navigation components; the Web UI contract verifier remains green.

- [x] REQ-MOBILE-001 / REQ-MOBILE-002: Make Mobile a bounded role-execution surface and align navigation terminology.
  - Test: 390px browser review shows Home / Projects / Workspace / Me as four persistent items and Scan as a top action; C-level organization configuration and full audit/export are unavailable or explicitly handed off to Web; every Mobile write action is a policy-approved B-level single-object action with online server-state recheck.

## P1

- [x] REQ-VERIFY-001: Keep verification commands accurate for the real project stack.
  - Test: every command listed in `TDD.md` runs against the current monorepo or the blocker is recorded in `docs/state/CHANGELOG.md`.

- [x] LOG-STD-003: Fix Silent catch blocks.
  - Fixed 16 silent catch blocks across: `backend/local_server/__init__.py`, `apps/axi-docs/app/project_manager.py`, `apps/app-search-system/backend/build_embedding.py`, `apps/app-search-system/backend/build_parallel.py`, `apps/app-search-system/backend/scripts/run_pipeline.py`, `apps/app-search-system/backend/api_sop.py`, `apps/app-search-system/backend/scripts/build_chroma.py`, `backend/mini_agent/skills/slack-gif-creator/core/typography.py`, `backend/mini_agent/skills/slack-gif-creator/core/validators.py`, `backend/mini_agent/skills/slack-gif-creator/core/frame_composer.py`.

- [x] LOG-STD-007: Go zerolog时间戳改为RFC3339.
  - Changed `zerolog.TimeFieldFormat` from `zerolog.TimeFormatUnix` to `time.RFC3339` in `services/api-gateway/cmd/gateway/main.go:160` to comply with unified log timestamp standard.

- [x] REQ-BOUNDARY-002: Service contracts declare six-layer paths before merge.
  - Test: every modified service under `services/` has its `entry / authority / downstream / renderer / audit / verification` declared in the PR description and verified against `docs/rules/epap-six-layer-sop.md`.

- [x] REQ-COMMUNICATION-001: Keep communication-gateway above business logic.
  - Test: `pnpm --filter @axi/workstation-communication-gateway test` passes and the gateway source does not import Codex, workspace index, memory tables, or project state owners.

- [x] REQ-WORKBENCH-002: Keep Web / mobile rendering boundaries clean.
  - Test: 1440px Web smoke renders Axi Dashboard chrome at `:5173`; 390px mobile-app smoke renders the 微信式居中顶栏、加号菜单、四个常驻导航项与顶部扫码入口 at `:5174`; both app-specific contract verifiers pass and neither app imports the other app’s implementation.

- [x] REQ-DOC-002: Keep the v2 zero-context manifest current.
  - Test: `docs/project-docs.manifest.json` parses as JSON, references only project-local files, contains no secret values, and reflects the latest entrypoints, contracts, and verification evidence.

- [x] REQ-AXI-CODER-001: Keep Axi Coder snapshots free of hard-coded neighbor paths.
  - Test: no Axi Coder snapshot contains a hard-coded `/projects/axi-notify/...` artifact path; resolution goes through environment variables and `workspace://` contract references.

- [x] REQ-MOBILE-001: Keep the independent WeChat-style mobile app and its shared foundation auditable.
  - Test: `apps/workbench-mobile` owns its Home / Projects / Workspace / Me pages, centered header, four persistent navigation items, badges and Scan action/page; `packages/workbench-foundation` lists shared session / locale keys; mobile theme switching round-trips through `axi.workbench.mobile.theme.mode` without importing Web layout code.

- [x] REQ-MILESTONE-001: Update `MILESTONE.md` after each verified delivery batch.
  - Test: each milestone records its objective, status, evidence, exit criteria and unresolved risks; the latest verified delivery evidence is current. Historical submit-log back-linking remains tracked separately by `REQ-LOG-001`.

- [x] REQ-CROSS-001 / REQ-DELIVERY-001: Add cross-device continuity only after a capability has an explicit ownership and action-policy record.
  - Test: each dual-surface flow has a shared business object identifier, action-level/authority declaration, server-side authorization/audit evidence, a `handoff correlation id` recorded at source, target and final action, and a context-preserving handoff to Web when Mobile cannot complete it.

## P3: Handoff Implementation (2026-09-15)

| ID | Feature | Status | Tests | Evidence | External Gate |
|----|---------|--------|-------|----------|--------------|
| P3-01 | Batch Handoff Creation | Completed (Unit) / In Progress (HTTP) | 10 unit + 12 HTTP | `batch-handoff.test.mjs` + `batch-handoff-http.test.mjs` | HTTP route not implemented |
| P3-02 | Scenario-Based SLA Configuration | Completed | 12 | `services/control-plane/test/sla-config.test.mjs` | None |
| P3-03 | Web-to-Mobile Handoff Lifecycle | Completed (Unit) / In Progress (HTTP) | 9 unit + 5 HTTP | `web-to-mobile-handoff.test.mjs` + `web-to-mobile-http.test.mjs` | HTTP action routes not implemented |
| P3-04 | Approval Scan Handoff Integration | Completed | 19 | `services/control-plane/test/approval-scan.test.mjs` | None |
| P3-05 | Web UI - Creation Form | Completed | 0 (UI) | `apps/workbench/src/pages/admin/HandoffCreate.tsx` | Pending External Verification |
| P3-06 | Mobile UI - Detail View | Completed | 0 (UI) | `apps/workbench-mobile/src/pages/HandoffDetail.tsx` | Pending External Verification |
| P3-07 | Mobile UI - Incoming List | Completed | 0 (UI) | `apps/workbench-mobile/src/pages/IncomingHandoffs.tsx` | Pending External Verification |
| P3-08 | Mobile UI - All Handoffs List | Completed | 0 (UI) | `apps/workbench-mobile/src/pages/HandoffPage.tsx` | Pending External Verification |
| P3-09 | API Client Hooks | Completed | 0 (hooks) | `packages/api-client/src/hooks/handoff.ts` | None |
| P3-10 | Handoff Expiry Scheduler | Completed | 1+ | `services/control-plane/test/approval-scan.test.mjs` | None |
| P3-11 | Handoff Audit Surface Fields | Completed | Bundled | `services/control-plane/test/approval-scan.test.mjs` | None |
| P3-12 | Action Level Risk Mapping | Completed | Bundled | `services/control-plane/test/batch-handoff.test.mjs` | None |

**Summary**: 12 P3 items, 52 unit tests passing (P3-01: 10, P3-02: 12, P3-03: 9, P3-04: 19, bundled: P3-10/11/12), 17 HTTP integration tests pending route implementation in server.mjs, 4 UI components pending external device verification.

### P3-01: Batch Handoff Creation
- **Status**: Completed (Unit) / In Progress (HTTP integration)
- **Test Count**: 10 unit tests pass; 12 HTTP integration tests fail (route not implemented)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/batch-handoff.test.mjs`, `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/batch-handoff-http.test.mjs`
- **External Gate**: HTTP route `/internal/web/v1/batch-handoffs` needs implementation in control-plane.mjs
- **Details**: Creates multiple handoffs with a common `batchId` (format: `BATCH-{timestamp}-{8-char-hash}`) in a single operation; handles partial success/failure; action level defaults (B) and risk mapping (A=low, B=medium, C=high, D=destructive)

### P3-02: Scenario-Based SLA Configuration
- **Status**: Completed
- **Test Count**: 12 tests
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/sla-config.test.mjs`
- **External Gate**: None
- **Details**: Configurable SLA durations per scenario type: approval (1h urgent), alert (15min urgent), task (24h standard), project (72h lowPriority); environment variable override via `AXI_HANDOFF_EXPIRY_MS`

### P3-03: Web-to-Mobile Handoff Lifecycle
- **Status**: Completed (Unit) / In Progress (HTTP integration)
- **Test Count**: 9 unit tests pass; 5 HTTP integration tests fail (route not implemented)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/web-to-mobile-handoff.test.mjs`, `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/web-to-mobile-http.test.mjs`
- **External Gate**: HTTP routes for `POST /handoffs/:id` with `reject`/`complete` action need implementation in server.mjs
- **Details**: Full state machine: created → delivered → accepted/rejected → completed/failed; includes `HandoffStatus` enum and `HandoffTransitions` maps

### P3-04: Approval Scan Handoff Integration
- **Status**: Completed
- **Test Count**: 19 tests
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/approval-scan.test.mjs`
- **External Gate**: None
- **Details**: C/D level scan decisions route to Web; owner binding (403 for wrong owner); approval revalidation before lifecycle changes (409 if approval no longer pending); expiry cascade; rejection requires reason

### P3-05: Web UI - Creation Form
- **Status**: Completed (Pending External Verification)
- **Test Count**: 0 (UI component)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/apps/workbench/src/pages/admin/HandoffCreate.tsx`
- **External Gate**: Gateway URL, TLS, ZITADEL auth
- **Details**: Ant Design form with direction, targetSurface, actionLevel, objectType, objectId, reason fields

### P3-06: Mobile UI - Detail View
- **Status**: Completed (Pending External Verification)
- **Test Count**: 0 (UI component)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/apps/workbench-mobile/src/pages/HandoffDetail.tsx`
- **External Gate**: Real mobile device, control plane endpoint
- **Details**: Displays handoff details; accept/reject actions with reason input for rejection

### P3-07: Mobile UI - Incoming List
- **Status**: Completed (Pending External Verification)
- **Test Count**: 0 (UI component)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/apps/workbench-mobile/src/pages/IncomingHandoffs.tsx`
- **External Gate**: Real mobile device, control plane endpoint
- **Details**: Lists incoming handoffs filtered by status=opened; navigates to detail on tap

### P3-08: Mobile UI - All Handoffs List
- **Status**: Completed (Pending External Verification)
- **Test Count**: 0 (UI component)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/apps/workbench-mobile/src/pages/HandoffPage.tsx`
- **External Gate**: Real mobile device, control plane endpoint
- **Details**: Lists all handoffs for device session; shows rejection reason if present

### P3-09: API Client Hooks
- **Status**: Completed
- **Test Count**: 0 (hooks library)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/packages/api-client/src/hooks/handoff.ts`
- **External Gate**: None
- **Details**: Exports `useCreateHandoff`, `useHandoffs`, `useHandoff`, `useAcceptHandoff`, `useRejectHandoff` with React Query integration

### P3-10: Handoff Expiry Scheduler
- **Status**: Completed
- **Test Count**: 1+ (bundled in approval-scan.test.mjs)
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/approval-scan.test.mjs`
- **External Gate**: None
- **Details**: Background scheduler auto-expires overdue handoffs; notification callback after durable audit; failure isolation

### P3-11: Handoff Audit Surface Fields
- **Status**: Completed
- **Test Count**: Bundled
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/approval-scan.test.mjs`
- **External Gate**: None
- **Details**: All audit events include `sourceSurface` and `targetSurface` fields

### P3-12: Action Level Risk Mapping
- **Status**: Completed
- **Test Count**: Bundled
- **Evidence Path**: `/Volumes/code/workspace/projects/axi-workbench/services/control-plane/test/batch-handoff.test.mjs`
- **External Gate**: None
- **Details**: Action levels A/B/C/D map to risk levels: low/medium/high/destructive

## P2

- [ ] REQ-LOG-001: Promote submit-log discipline to P0 once weekly cadence stabilizes.
  - Test: `pnpm audit:submit-logs -- --since <batch-base> --strict` verifies each reviewed batch commit has a direct `docs/logs/submit/<batch-id>.md` and same-commit `CHANGELOG.md` touch; default mode reports historical gaps without failing unrelated boundary checks. The historical corpus still needs reconciliation before promotion to P0.

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

### In progress — Position the workbench as a role-oriented multi-surface control system (2026-08-09)

- **Problem:** The two independent applications had engineering separation, but the product contract did not clearly say which roles and action levels belong to Web, Mobile or professional tools. Old documents also described a five-item mobile tab bar while the current implementation has four persistent navigation items plus a Scan action, and both ends used the word "scan" for different security flows.
- **Solution:** Use official public product-shape references from 千牛、美团商家版、携程 eBooking and 飞猪商家中心 to set Web as the control center, Mobile as a bounded role-execution/auxiliary surface, and Host/vertical tools as professional surfaces. Add A/B/C/D action policy, capability allocation, navigation facts, scan semantics, cross-device handoff and phased delivery requirements to the project PRD/TDD.
- **Expected result:** New work is assigned to a role, action level and surface before implementation; no feature is duplicated merely to achieve visual parity; Mobile can safely close approved single-object work without becoming a small Web backend.
- **Acceptance:** `REQ-POSITION-001`, `REQ-ARCH-001`, `REQ-ACTION-001`, `REQ-REFERENCE-001`, `REQ-SURFACE-001`, `REQ-WEB-001/002`, `REQ-MOBILE-001/002`, `REQ-CROSS-001`, `REQ-SCAN-001` and `REQ-DELIVERY-001` appear in the PRD, TDD, TODO, Milestone and Changelog with product-specific checks.
- **Evidence:** `docs/state/PRD.md`; `docs/specs/2026-08-09-multi-surface-admin-positioning/MARKET-REFERENCE.md`; `docs/specs/2026-08-09-multi-surface-admin-positioning/`.
- **Dependencies:** `docs/architecture/source-catalog.md`, `apps/AGENTS.md`, the Web/Mobile contract verifiers, `packages/workbench-foundation`, API/schema contracts and the gateway audit boundary.
- **Status:** Product direction defined; implementation has not started.

### Ongoing — Keep zero-context evidence fresh

- **Problem:** Monorepo package moves, new dashboard apps, service contracts, environment variables, and six-layer ownership changes can make onboarding facts stale quickly.
- **Solution:** Update the v2 manifest whenever entrypoints, package scripts, contracts, required services, ownership, TODO priorities, milestone, or verification behavior changes.
- **Expected result:** Future agents can use one current manifest to choose the correct subtree guidance and verification lane.
- **Acceptance:** Each relevant change updates `updated`, `currentWork`, `contracts`, and `verification`; verified status requires a fresh safe smoke; TODO, milestone, and changelog remain consistent.
- **Evidence:** Fresh smoke output in `verification.evidence`, JSON/path checks, and a matching `CHANGELOG.md` entry.
- **Dependencies:** Owners of `apps/`, `services/`, `packages/`, `ai/`, `infra/`, `prompts/`, and `tools/`.
- **Status:** Ongoing.
