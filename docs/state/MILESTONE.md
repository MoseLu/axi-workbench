# Milestone

## Current Status

Axi Workbench is the canonical AxiomaticWorld workbench: independent Web admin (`apps/workbench`),
independent mobile app (`apps/workbench-mobile`), desktop host shell (`apps/devsvc-dashboard`), six-layer control plane running in
`services/control-plane` + `services/communication-gateway`, and the v2 zero-context manifest
lives at `docs/project-docs.manifest.json`. PRD/TDD/TODO have been refreshed to track every
`REQ-*` against a concrete verification command. Product direction is now explicit: Web is the
complete backend-management control center; Mobile is the auxiliary, role-execution surface for
personal context, alerts and policy-approved single-object actions. Professional/physical work stays
in its dedicated tools.

## Milestone 0: Multi-surface Product Positioning

- Objective: 固化 Web 控制中心、Mobile 角色执行端与专业工具的职责和动作等级边界。
- Status: Delivered — P0–P5 implemented on 2026-08-09
- Evidence: `CAPABILITY-INVENTORY.json` records 17 current Web/Mobile/Host capability groups and is enforced by `pnpm check:capabilities`; Web navigation is grouped by control object, its `运行状态` and `工作项` surfaces consume the Control Plane projection, and generic desktop scanning is excluded; Mobile projects, workspace and search consume the authenticated Control Plane projection and never fall back to static business data; `ApprovalScanPreview` / `MobileApprovalDecision` / `HandoffContext` contracts, Gateway proxying, Control Plane audit tests and `/admin/handoff/:id` implement C/D continuation; DevSvc hosted specialist entries declare Owner, authorization, audit and fallback.
- Exit criteria: Met for this batch. New user-facing work now updates the machine-checked inventory and retains separate Web/Mobile browser acceptance, Gateway/Control Plane policy tests, and host execution-boundary metadata.
- Unresolved risks: 外部身份、生产授权源和真实设备/第三方服务验收不属于本地产品定位证据，仍需在对应外部环境验证。
- 2026-08-22 更新：完成能力台账结构化文档 [`CAPABILITY-OWNERSHIP.md`](./CAPABILITY-OWNERSHIP.md)，包含 Web 管理控制中心能力清单（10 项）、Mobile 角色执行端能力清单（7 项）、跨端交接能力（4 场景）；发布跨端交接协议草案 [`HANDOFF-PROTOCOL.md`](./HANDOFF-PROTOCOL.md)，定义 Correlation ID 格式（`HF-{timestamp}-{uuid}`）和状态机（`created → delivered → accepted → completed/failed/expired`）。

## Milestone 1: Documentation Baseline

- Objective: 建立可由零上下文 agent 读取、验证并交接的项目文档基线。
- Status: Completed
- Evidence: `README.md`, `README.zh-CN.md`, `AGENTS.md`, `INDEX.md`, `CHANGE.md`, `docs/state/CHANGELOG.md`, `docs/state/TODO.md`, `docs/state/MILESTONE.md`, `docs/state/PRD.md`, `docs/state/TDD.md`, `docs/state/VERIFICATION.md` exist and cross-reference each other through `REQ-*` IDs.
- Exit criteria: every required document exists, the minimum documentation check in `TDD.md` passes, and `docs/project-docs.manifest.json` is at v2.
- Unresolved risks: manifest 的历史 `legacy` 标记仍受项目治理说明约束，状态类文档与旧版文档入口的最终收敛仍需单独治理批次。

## Milestone 2: Verification Alignment

- Objective: 让每个产品表面、服务和共享合同都有可复现且与真实栈一致的验证入口。
- Status: In progress
- Evidence: P0–P5 now have concrete type, unit, API, schema, gateway, host, contract, boundary and browser checks; the latest 2026-08-09 delivery records a signed-in 1280×720 desktop Web browser observation and a 390px Mobile observation in `VERIFICATION.md`. `packages/workbench-foundation` still owns only shared session and locale behavior.
- 2026-09-13 batch evidence: whole-repository `pnpm type-check` and `pnpm test` pass with 26/26 successful tasks; Web/Mobile Playwright pass 25/25 and 1/1; `make verify-go`, `make verify-helm`, `make verify-identity-mailpit`, PostgreSQL RLS integration with dedicated migration/runtime roles, API Gateway Redis session restart/concurrency integration, Fleet Console validation, DevSvc tests, utility tests, Verification Inbox tests and Maven compatibility-service tests pass.
- Unresolved risks: 本地 Mailpit、PostgreSQL RLS 与真实 Redis 会话集成已通过；真实 ZITADEL、Kubernetes、生产 SMTP、生产 Grant owner 和跨故障注入验收仍未闭合。
- Web legacy consumer evidence: `@epap/ui` consumer validation and inactive-consumer cleanup are complete for the current Web boundary; the compatibility package remains outside the active Web runtime, while `@epap/api-client` remains an independent API compatibility contract.
- Web legacy cleanup evidence: the historical `Sidebar.tsx`/`TabBar.tsx` files were unreferenced by the live `AxiDashboardShell` and have been removed with their CSS; the Web dependency and lockfile entry for `@epap/ui` are gone, while the compatibility package remains outside the active Web runtime.
- Exit criteria: every P0/P1 TODO item has at least one concrete test command line, and each REQ has both an `Acceptance Criteria` row in `PRD.md` and a matching test in `TDD.md` / `TODO.md`.

## Milestone 3: Operational Handoff

- Objective: 让零上下文接手、交接和审计路径可由项目文档与提交记录复现。
- Status: Delivered — P3 implemented on 2026-09-15
- Evidence: `docs/HANDOFF.md` 90-second read order uses AGENTS → README → six-layer SOP → boundary SOP → PRD; `CHANGELOG.md` records the multi-surface implementation and `VERIFICATION.md` contains refreshed browser evidence. A Mobile-to-Web handoff now persists source, target and final action under one correlation id; Web can now reject `pending/opened` continuation with a required reason and audit-linked verified subject.
- **2026-09-15 P3 delivery evidence**: 12 P3 items implemented:
  - P3-01: Batch Handoff Creation (10 unit tests pass; 12 HTTP tests pending route implementation) — `batch-handoff.test.mjs` + `batch-handoff-http.test.mjs`
  - P3-02: Scenario-Based SLA Configuration (12 tests) — `sla-config.test.mjs`
  - P3-03: Web-to-Mobile Handoff Lifecycle (9 unit tests pass; 5 HTTP tests pending route implementation) — `web-to-mobile-handoff.test.mjs` + `web-to-mobile-http.test.mjs`
  - P3-04: Approval Scan Handoff Integration (19 tests) — `approval-scan.test.mjs`
  - P3-05: Web UI Creation Form — `HandoffCreate.tsx` (pending production verification)
  - P3-06: Mobile UI Detail View — `HandoffDetail.tsx` (pending production verification)
  - P3-07: Mobile UI Incoming List — `IncomingHandoffs.tsx` (pending production verification)
  - P3-08: Mobile UI All Handoffs List — `HandoffPage.tsx` (pending production verification)
  - P3-09: API Client Hooks — `handoff.ts`
  - P3-10: Handoff Expiry Scheduler — bundled in approval-scan.test.mjs
  - P3-11: Audit Surface Fields — bundled in approval-scan.test.mjs
  - P3-12: Action Level Risk Mapping — bundled in batch-handoff.test.mjs
  - Total: 50 unit tests covering backend logic; 17 HTTP integration tests pending route implementation; 4 UI components pending external device verification
- Exit criteria: CHANGELOG records the doc refresh, `docs/state/VERIFICATION.md` carries the latest browser evidence, and there is no "next milestone" line in production contracts.
- Unresolved risks: UI components (P3-05 to P3-08) require real mobile device and production endpoint verification; historical submit log gaps remain P2 governance risk.

## Milestone 4: Six-Layer Discipline

- Objective: 让控制面和通信层的入口、权威事实源、下游、渲染、审计与验证责任可审查。
- Status: In progress
- Evidence: `docs/rules/epap-six-layer-sop.md` is enforced by `pnpm check:boundaries`; `services/control-plane` and `services/communication-gateway` now declare entry / authority / downstream / renderer / audit / verification paths in their READMEs, and the compatibility-only `services/core-service` is explicitly excluded from production six-layer ownership.
- Exit criteria: every service change enters the merge queue with a SOP-aligned declaration, and no regression on the six-layer smoke.
- Unresolved risks: compatibility-only 服务不承担生产六层 owner；其余生产服务的声明需要在后续每个服务变更的 review/merge 记录中持续复用。

## Milestone 5: Workspace RBAC Execution Gate

- Objective: 所有受控执行都经过注册授权源、持久化 PolicyDecision、主体/资源/动作绑定、审批/风险/证据和审计链路。
- Status: In progress
- Evidence: `services/control-plane` now exposes the registry-backed policy decision endpoint, records server-attributed `policy_decision.evaluated` events, and gates core and mobile jobs, job/AgentTask cancellation, approval decisions, registered command runs, and natural-language execution before invoking an executor. Mobile ApprovalRequest and dispatched Job records retain the originating PolicyDecision reference. Core and mobile job submission, cancellation, approval, registered-command, and approval-scan records now persist the originating `policyDecisionRef`. The enforced Control Plane surface rejects direct execution without a valid decision reference, and direct natural-language execution evaluates and audits the configured policy before invoking an executor; `createControlPlane()` and the HTTP server enable this enforcement by default. Mobile `actionLevel` is synchronized across runtime, OpenAPI and TypeScript contracts. The communication gateway now submits and polls through the authenticated `/internal/communication/v1` boundary. Governance snapshots and the Web posture summary expose structured RBAC source readiness without grant contents, including configured/unconfigured/unresolved/invalid states and owner/version/count metadata. Commits `7595d03`, `59b05c8`, `33b64a0`, `a2724b6`, `b973e0d`, `ac0b194`, `47c25e8`, `ca867f3`, and `e6621a7` carry the enforcement, posture, and decision-trace implementation; the full control-plane suite passes 169/169 and the communication-gateway suite passes 15/15.
- Phase 6 evidence: failed AgentTasks, registered commands, and workflow jobs now create durable typed Risk and Incident records linked to target, correlation, source assessment, and policy decision metadata; the governance snapshot and Workbench summary expose the records and open counts. The focused control-plane suite passes 170/170.
- Risk lifecycle evidence: `/risks` exposes the durable pair and a policy-gated transition route; `acknowledged`, `resolved`, and `waived` transitions update both records, require a closure reason where applicable, and emit correlated audit events. The focused control-plane suite passes 171/171.
- Implementation recorded in commit `4d26856`; lifecycle mutations remain fail-closed when no registry-backed Grant source is available.
- Owner evidence: execution issues resolve the target owner from `workspace.json` before graph fallback and retain `ownerSource`; the test fixture proves registry precedence without fabricating Grant ownership. Implementation recorded in commit `2744063`.
- UI evidence: Governance Summary renders the persisted Risk detail fields and PolicyDecision reference alongside open Risk/Incident counts; the focused UI suite passes 2/2.
- UI lifecycle evidence: Risk actions use the authenticated Gateway hook, keep subject/policy fields server-derived, require a reason for resolution/waiver, and refresh the snapshot after success; the focused UI suite passes 3/3.
- Execution-boundary evidence: registered commands are parsed into argv and run without a shell; shell composition is marked non-executable and cannot be selected by natural-language or Mobile health execution. Control-plane regression passes 172/172 and communication-gateway passes 15/15.
- Contract evidence: `ManagedCommand` now requires explicit `ownerRef`, `source`, and `executorRef`; snapshot tests verify graph registration provenance and contracts remain 6/6.
- Evidence Contract: failed execution now persists a typed behavioral Evidence record under the control-plane cache and links the same reference from Risk, Incident, and creation-audit records; snapshot restart and Governance Summary tests verify the reference remains visible.
- Registered remediation evidence: graph/profile `remediation` declarations project as non-auto-executable `run_remediation` commands; high-risk remediation enters the existing ApprovalRequest → controlled Job → registered executor path, while direct query/API and forged approval payloads remain blocked. Control-plane regression passes 173/173.
- Risk contract evidence: execution-failure Risk records now carry explicit nullable `impactSnapshotRef`, preserving the distinction between a linked impact assessment and an unassessed failure.
- Execution evidence completeness: registered command success writes behavioral Evidence and links it through AgentTask/AuditReport; registered command failure links the Risk-created evidence back to the failed Job and AgentTask.
- Run evidence completeness: direct health/verify command results now expose the persisted execution evidence reference in `ControlActionResult`, keeping synchronous Run responses traceable alongside asynchronous Jobs.
- PolicyDecision persistence evidence: each configured policy evaluation writes an immutable decision record with correlation ID; snapshot restart and authenticated GET-by-ID tests verify the durable record, while the existing evaluated-event link remains intact.
- Policy-driven automation evidence: graph-declared automations project explicit enabled/paused/blocked/unregistered state and can trigger only an owner-matching registered health/verify command through the PolicyDecision gate; the control-plane regression passes 174/174.
- Interval worker evidence: opt-in interval automation ticks evaluate `automation:<id>` PolicyDecision records before execution, persist `lastRunAt`, reuse Run/Evidence/Audit, and stop cleanly; the control-plane regression passes 175/175.
- Web automation evidence: Governance Summary conditionally renders registered automation state and routes enabled-row triggers through the authenticated API client; the focused UI suite passes 4/4 and Workbench production build passes.
- Evidence freshness evidence: behavioral execution records carry a 15-minute TTL and snapshot generation recomputes fresh/stale status from the observation time; the control-plane regression passes 176/176.
- Evidence observation evidence: shared Governance Evidence requires an explicit `observationKey`; generated and persisted records expose stable grouping keys, with control-plane and Inspector fixtures updated and verified.
- Policy evidence completeness: every configured PolicyDecision now receives a persisted process Evidence reference, including secure default deny; policy endpoint, event, snapshot, and restart tests verify the same trace.
- Policy reference integrity evidence: controlled surfaces validate persisted decision existence, `allow` result, and expiry before execution; forged, deny, and expired references are rejected while the mobile `require_approval` path remains bounded to pending approval.
- Policy binding evidence: controlled surface guards also compare the persisted decision's resource and action to the requested operation; cross-resource reuse is rejected and the full control-plane suite remains 176/176.
- Subject binding evidence: authenticated Core/Mobile callers, approval replays, and automation ticks carry the decision subject into the guard; missing or mismatched subjects are rejected by regression coverage.
- Approval expiry evidence: pending ApprovalRequests carry a five-minute expiry, restart reload preserves it, and expired decisions are persisted/audited without Job dispatch; control-plane regression passes 177/177.
- Core approval escalation evidence: a persisted `require_approval` decision on `/jobs` returns a desktop pending ApprovalRequest with the PolicyDecision reference and bounded expiry; approval replay remains subject-bound and uses the controlled dispatch bridge; control-plane regression passes 179/179.
- Two-application verification evidence: Web tests pass 184/184 with UI contract/type-check/build green; Mobile tests pass 34/34 with contract/type-check/build green; Foundation type-check passes and the stale UI-verifier blocker is cleared.
- Handoff lifecycle evidence: Web can list authenticated handoff history, filter status, open a detail continuation, re-read the current Control Plane project state without falling back to the handoff snapshot, and Mobile can list history restricted to its authenticated device actor; lifecycle events are queryable under their `handoffId`; bound Mobile-to-Web records are restricted to the originating verified Web owner subject for history and terminal actions, with owner-mismatch and linked-approval-state/expiry denials audited before mutation; an overdue linked ApprovalRequest and its handoff become expired together before the target receives 409; Web can reject a pending/opened continuation only with a non-empty reason, and pending/opened records become terminal `expired` after the default 24h or configured positive `handoffExpiryMs`/`AXI_HANDOFF_EXPIRY_MS` SLA through the stoppable background worker or on-demand sweep; the worker can enqueue `handoff.expired` to an external notification relay after durable audit, and callback failure is fail-safe. Control Plane regression passes 196/196, including production rejection of a missing or development-default gateway internal token, Registry/Graph-only optional resource path resolution and complete-field normalization for persisted evidence; Web regression passes 184/184, Mobile regression passes 34/34, Schema/OpenAPI and Gateway proxy checks pass, and correlation, source actor, owner subject, verified target subject, reason/expiry metadata are retained in persistence and audit.
- Delivery-record evidence: the strict submit-log audit passes 1/1 for the latest commit (`HEAD~1..HEAD`) and the preceding handoff-owner batch passes 4/4; it recognizes 50 historical batch-covered commits, while 236 submit-log coverage gaps and 537 same-batch Changelog evidence gaps remain an explicit P2 governance risk tracked by `REQ-LOG-001`.
- Axi Coder boundary evidence: native suite snapshots no longer derive `axi-notify` from `AXI_WORKSPACE_ROOT`; explicit environment resolution and the `workspace://` fallback are covered by 20 Rust tests, 14 Axi Coder tests, type-check, build, and the boundary check.
- Tracker reconciliation evidence: root docs, Control Plane smoke, communication-gateway boundary, v2 manifest, and Axi Coder snapshot boundary rows now reflect passing evidence; `workspace-project handoff-check axi-workbench` reports score 10 with no warnings.
- Browser boundary evidence: Web Playwright passes 25/25 and Mobile Playwright passes 1/1 on the current checkout; Web UI contracts, Mobile UI contracts, and both application type/build checks remain green, including authenticated handoff current-state re-read, desktop shell geometry and mobile responsive coverage.
- Implementation recorded in commit `165055d`; the current risk/incident owner remains `unknown` until the authoritative governance owner contract is supplied.
- Current boundary: the real workspace registry has no `settings.rbac.grants` owner/source, so production decisions remain secure default deny. Mobile tests use an explicit temporary Grant source; provider-owned Grant management and direct internal control-plane callers still require the identity/registry owner contract.
- Unresolved risks: production Grant source ownership and direct internal caller identity remain external to this repository; until that contract is registered and verified, fail-closed behavior is the only accepted production posture.
- Exit criteria: a registered Grant source is owned and verified, every controlled mobile and communication action emits and references a persisted PolicyDecision before execution, and direct internal control-plane callers cannot bypass the same gate.
