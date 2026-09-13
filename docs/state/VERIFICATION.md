# Axi Workbench Verification

## 2026-09-14 control-plane security and two-application verification refresh

- Control Plane: `pnpm --filter @axi/workstation-control-plane test` passes 196/196; `pnpm --filter @axi/workstation-control-plane smoke` passes with 43 resources across six layers. Core `/jobs` approval escalation, subject-bound PolicyDecision references, expiring ApprovalRequests, Web handoff history filtering and owner binding, linked ApprovalRequest status/expiry revalidation with consistent handoff expiry, handoffId event projection, configurable/default-24h expiry including environment parsing, the stoppable expiry worker, external notification enqueue boundary, production fail-closed handling for a missing or development-default gateway internal token, registry/graph-only optional resource path resolution, and complete-field normalization for persisted evidence are covered by the current regression suite.
- Personal OS governance projection: `node --test test/personal-os.test.mjs test/personal-os-http.test.mjs` passes 13/13; project eligibility is derived from explicit object type/scope/lifecycle/external declarations, with no `kind` keyword classification.
- Communication and contracts: `pnpm --filter @axi/workstation-communication-gateway test` passes 15/15; `pnpm --filter @axi/workstation-contracts test` passes 6/6; `pnpm --filter @epap/api-client type-check` passes.
- Web: `pnpm --filter @axi/workbench test` passes 184/184; `pnpm --filter @axi/workbench type-check`, `node apps/workbench/scripts/verify-ui-contracts.mjs`, and `pnpm run build:workbench` pass. The authenticated `/admin/handoff` history projection filters status and opens `/admin/handoff/:id` detail; the detail page re-reads the current Control Plane project state and refuses to fall back to the handoff snapshot when that read fails, while retaining the existing completion/rejection controls.
- Web legacy consumer validation: the two historical `@epap/ui` consumers (`Sidebar.tsx` and `TabBar.tsx`) were not in the live `AxiDashboardShell` render chain and are removed; the Web package has no `@epap/ui` dependency or source import. `@epap/api-client` remains a separate API compatibility exit used by 11 production pages plus one test. Shared `@axi/core`/`@axi/shell` exports were checked, and Web type-check, 184/184 tests, UI contract verification, production build and boundary check pass; see `docs/audit/20260913-web-legacy-consumer-validation.md`.
- Mobile: `pnpm --filter @axi/workbench-mobile test` passes 34/34; `pnpm --filter @axi/workbench-mobile type-check`, `pnpm --filter @axi/workbench-mobile verify:contracts`, and `pnpm --filter @axi/workbench-mobile build` pass. The paired-device `/handoffs` page reads only the authenticated device's server-backed handoff history, and pairing QR gateway hints are restricted to private LAN or the first-party HTTPS origin.
- Browser: `pnpm --dir apps/workbench e2e` passes 25/25 and `pnpm --dir apps/workbench-mobile e2e` passes 1/1. Web coverage includes authenticated handoff detail current-state re-read, account/code/password layout stability, legal routes, QR expiry/error states, desktop shell geometry, and 375px overflow; Mobile coverage runs in a real browser against its independent app server.
- Handoff lifecycle: pending/opened Web continuations require an explicit reason for rejection and become terminal `expired` after the default 24h deadline through the background worker or on-demand observation/sweep; correlation and expiry/rejection audit fields are covered by Control Plane and Web tests.
- Handoff audit identity: lifecycle audit records retain the originating `sourceActorRef` and bound `sourceOwnerRef`; Web-open records retain the verified target `actorRef`, and expiry/notification records use the explicit system actor. Owner-mismatch and linked-approval-state/expiry denials are audited before any state mutation. Focused lifecycle assertions and the full Control Plane suite cover this chain.
- Delivery-record audit: `pnpm audit:submit-logs -- --since HEAD~3 --strict` passes 3/3 for the latest reviewed commits; the batch-aware historical report recognizes 50 batch-covered commits, while 236 commits still lack submit-log coverage and 537 lack same-batch Changelog evidence. Historical gaps are not treated as a current-batch failure.
- Handoff notification boundary: expiry is durably recorded before the optional `handoff.expired` enqueue callback; callback failure leaves the terminal state intact and produces a failure audit event.
- Shared foundation and boundaries: `pnpm --filter @axi/workbench-foundation type-check` and `pnpm run check:boundaries` pass. Production build output retains existing non-blocking large-chunk advisories.
- Whole-repository verification: `pnpm type-check` and `pnpm test` pass; Turbo reports 26/26 successful tasks. `pnpm --dir apps/devsvc-dashboard test` passes 21/21, `pnpm --filter @epap/utils test` passes 3/3, `pnpm --dir apps/verification-inbox test` passes 3/3, and `pnpm --dir services/core-service test` passes Maven `BUILD SUCCESS`.
- Infrastructure and registry checks: `make verify-go`, `make verify-helm`, and `python3 infra/fleet-console/scripts/fleetctl.py validate` pass; Helm reports only the optional Chart icon recommendation and Fleet validates 5 machines. The opt-in PostgreSQL RLS integration and API Gateway real-Redis session restart/concurrency integration also pass on 2026-09-13.
- Mailpit and external gates: `make verify-identity-mailpit` passes on 2026-09-13 after starting the local Mailpit container on `127.0.0.1:1025`; this proves local SMTP delivery only. Cluster-level, real ZITADEL, production SMTP and production identity/Grant-owner gates remain external.

## 2026-08-09 Web / mobile application split and PRD remediation

The user workbench is two independently runnable applications with an explicit ownership boundary:

- Web admin (`apps/workbench`, `http://127.0.0.1:5173`): `@axi/shell` Axi Dashboard Chrome, including sidebar, topbar actions, tabs, breadcrumbs, theme switch, and admin settings panel.
- Mobile app (`apps/workbench-mobile`, `http://127.0.0.1:5174`): its own Vite entry, header, tab bar, login surface, and mobile page composition. It does not import the Web application shell.
- Shared scope: `@axi/workbench-foundation` owns auth-session behavior and locale preference; API/contracts/tokens remain package contracts. No page, route, or layout is shared across the two applications.

### Commands

```bash
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench build
node apps/workbench/scripts/verify-ui-contracts.mjs
pnpm --filter @axi/workbench-foundation type-check
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile test
pnpm --filter @axi/workbench-mobile build
pnpm --filter @axi/workbench-mobile verify:contracts
pnpm check:boundaries
```

### Browser evidence

- At 1280×720 in the signed-in in-app browser, `:5173/admin/operations` rendered the desktop Axi Dashboard shell with grouped sidebar entries `概览 / 项目与工作 / 组织与访问 / 账号与设置`; the desktop child entries are `工作台概览 / 运行状态 / 项目组合 / 工作项`. No Mobile topbar or bottom navigation existed. The locally unavailable Control Plane rendered one explicit “运行状态暂不可用” state rather than zero-value metrics, a fake table or sample records.
- At the same desktop size, `:5173/admin/task` rendered the “工作项” table workspace with a task/project/approval search box and `全部 / 处理中 / 需处理 / 已结束` filters. With the Control Plane unavailable, it rendered one explicit unavailable state rather than placeholder rows. Browser checks found page content, no Vite error overlay and an empty captured console-error list.
- `:5173/admin/scan` now redirects to `:5173/admin/dashboard`; the redirected document contained no `video`, image-file input or canvas scanner nodes. The product navigation and global search do not expose a scanner entry.
- At a 390×844 mobile emulation, the unauthenticated Mobile workspace rendered “需要设备配对” rather than a static project sample or an endless loading state. Its persistent navigation contains only Home / Projects / Workspace / Me. The top “更多” menu exposes “扫一扫”, whose page is “审批扫码” and explicitly says it is not for web-login confirmation. `verify:contracts` separately asserts the four persistent items, the top Scan action, authenticated projection pages, and the independent Identity confirmation route; the request-timeout unit test covers an authenticated unavailable gateway becoming an explicit unavailable state.
- The Vite development proxy logged the expected Control Plane connection refusal while the UI converted it to the explicit unavailable state. The unavailable Control Plane is not replaced with a static substitute.

The historical 2026-08-09 evidence below recorded a UI verifier blocker; the current 2026-09-13 checkout clears it: `node apps/workbench/scripts/verify-ui-contracts.mjs` passes, and Web E2E passes 25/25 with the existing user-owned Dashboard CSS change present. The production build retains only the existing non-blocking Rollup large-chunk advisory.

## 2026-08 Go API plane

- API Gateway: go test -race ./... passed. Coverage includes single-use OIDC state, opaque HttpOnly sessions, access-token audience/scope enforcement, explicit credentialed CORS origins, rate limiting, spoofed-header removal, QR completion proxying, and W3C trace continuation.
- Identity adapter: go test -race ./... passed. QR ticket/poll/resume material is hashed; short-lived transactions use Redis with atomic replay prevention, and email/EPS data remains PostgreSQL-backed. The current 2026-09-13 Mailpit integration delivery test passes; production SMTP remains external.
- Platform Core: go test -race ./... passed. The 2026-09-13 PostgreSQL RLS integration migrated the Compose `axi_platform` database with a dedicated BYPASSRLS account and queried it through NOBYPASSRLS runtime credentials; it proved API and direct-SQL denial of an admin downgrading another owner, plus zero visible cross-tenant rows. API Gateway's opt-in real-Redis integration also passed session restore after restart, predecessor/successor revocation, concurrent logout/rotate protection, and invalid-TTL no-partial-write cases; fixtures clean only their generated keys.
- Helm strict lint and template passed, including the negative rendering check that an enabled Outbox worker without a delivery URL is rejected. The only lint note is Helm’s optional Chart icon recommendation.

Cluster-level acceptance is still pending an attached Kubernetes cluster, real ZITADEL issuer/client, SMTP credentials, and failure-injection environment; no production infrastructure was changed by this verification.
