# Axi Workbench Handoff

- Project: `axi-workbench`
- Path: `/Volumes/code/workspace/workbench/axi-workbench`
- Owner: `Axi Core Projects`
- Readiness: `verified`
- Purpose: Canonical AxiomaticWorld role-oriented multi-surface control workbench: Web is the complete backend-management control center, Mobile is the bounded role-execution auxiliary surface, and professional/physical work stays in dedicated tools, all backed by the six-layer control plane, Go API plane, shared action contracts, local services, AI integrations, fleet tooling, and app scaffolding.

## 90-Second Read Order

1. `AGENTS.md`
2. `README.md`
3. `docs/rules/epap-six-layer-sop.md`
4. `docs/rules/axi-workbench-boundary-sop.md`
5. `docs/state/PRD.md`

## Entrypoints

- `docs/architecture/source-catalog.md`: Canonical physical source topology: application roles, runtime boundaries, root workspace membership, host registration, and cleanup order.
- `apps/workbench/src/main.tsx`: Independent Web management-control-center application: Axi Dashboard Chrome, sidebar, topbar plugins, tabs, breadcrumbs, settings, high-density cross-object management, governance and Web-only pages.
- `apps/workbench-mobile/src/main.tsx`: Independent Mobile role-execution auxiliary application: its own Vite entry, centered header, search/plus menu, four persistent Home/Projects/Workspace/Me navigation items, a Scan action, badges, login, and policy-bounded mobile page composition.
- `packages/workbench-foundation/src/index.ts`: Shared auth-session and locale-preference foundation for the independent user applications; no page or layout exports.
- `services/api-gateway/cmd/gateway/main.go`: Production Go API plane: public Gin gateway plus sibling identity-adapter and platform-core for ZITADEL, QR/email/EPS, tenant/RBAC and RLS business modules.
- `services/control-plane/src/server.mjs`: Software-layer control API and managed AgentTask runtime surface.
- `services/communication-gateway/src/server.mjs`: Communication-layer envelope routing and control-plane forwarding.
- `packages/schemas/src/index.ts`: Canonical IMEnvelope, AgentTask, and workstation contract exports.
- `infra/fleet-console/scripts/fleetctl.py`: Physical-service inventory and validation CLI.

## Commands

- Setup: `pnpm install`
- Start: `make docker-up && make migrate-identity && make migrate-platform`
- Start: `pnpm dev:workbench`
- Start: `pnpm dev:mobile`
- Start: `pnpm --filter @axi/workstation-control-plane start`
- Start: `pnpm --filter @axi/workstation-communication-gateway start`
- Health: `pnpm --filter @axi/workstation-control-plane smoke`
- Health: `python3 infra/fleet-console/scripts/fleetctl.py validate`
- Verify: `make verify-go`
- Verify: `make verify-helm`
- Verify: `pnpm --filter @axi/api-client --filter @axi/workbench-foundation --filter @axi/workbench --filter @axi/workbench-mobile type-check`
- Verify: `pnpm --filter @axi/workbench --filter @axi/workbench-mobile test`
- Verify: `pnpm --filter @axi/workbench --filter @axi/workbench-mobile build`
- Verify: `node apps/workbench/scripts/verify-ui-contracts.mjs`
- Verify: `pnpm --filter @axi/workbench-mobile verify:contracts`
- Verify: `pnpm check:boundaries`
- Smoke: `pnpm --filter @axi/workstation-control-plane smoke`

## Environment

- Runtimes: `Node.js >=18`, `pnpm >=8`, `TypeScript`, `Go`, `Python`, `Java`
- Services: `Control Plane`, `Communication Gateway`, `ZITADEL`, `PostgreSQL`, `Redis`, `Mailpit (local SMTP integration)`, `Kafka`, `Qdrant`, `MinIO`, `Prometheus`, `Grafana`, `Jaeger`
- `AXI_WORKSTATION_ROOT`: required=no, secret=no, source=control-plane environment
- `AXI_WORKSTATION_CONTROL_CACHE_DIR`: required=no, secret=no, source=control-plane environment
- `CC_CONNECT_MEMORY_DATABASE_URL`: required=no, secret=yes, source=local credentials or service environment
- `CODEX_BIN`: required=no, secret=no, source=control-plane environment
- `AXI_AGENT_PLATFORM_URL`: required=no, secret=no, source=control-plane environment
- `WORKFLOW_AGENT_PLATFORM_URL`: required=no, secret=no, source=workflow-engine environment
- `WORKFLOW_AGENT_ROUTE_CREDENTIAL_SECRET`: required=yes, secret=yes, source=workflow-engine environment
- `WORKFLOW_AGENT_INTERNAL_EVENT_TOKEN`: required=yes, secret=yes, source=workflow-engine environment

## Contracts

- Provides: `IMEnvelope and AgentTask schemas`, `Six-layer control-plane resource snapshots`, `Communication gateway routing`, `Axi Dashboard application surfaces`, `Independent Web admin and mobile workbench applications`, `Shared Workbench auth-session and locale foundation`, `ZITADEL-backed OIDC and PKCE business API boundary`, `Tenant-aware platform core with PostgreSQL RLS and transactional outbox`, `Axi App CLI scaffolding`, `task-execution-routing/v1 workflow-agent orchestration`
- Consumes: `Axi Agent Platform API when AXI_AGENT_PLATFORM_URL is configured`, `CC-Connect memory database`, `Codex CLI or Codex app-server runtime`, `Local infrastructure services declared in docker-compose.yml`, `Axi Agent Platform bounded read-only runtime`, `task-execution-routing/v1 governance contract`
- Contract files: `packages/schemas/src/index.ts`, `packages/workbench-foundation/src/index.ts`, `apps/workbench/src/layouts/MainLayout.tsx`, `apps/workbench-mobile/src/layouts/MobileShell.tsx`, `services/api-gateway/cmd/gateway/main.go`, `services/identity-adapter/cmd/identity-adapter/main.go`, `services/platform-core/cmd/platform-core/main.go`, `infra/helm/axi-workbench-platform/Chart.yaml`, `docs/adr/0001-zitadel-gin-platform-core.md`, `services/control-plane/src/control-plane.mjs`, `services/communication-gateway/src/gateway.mjs`, `services/workflow-engine/services/agent_runtime.py`, `services/workflow-engine/services/approved_effects.py`, `services/workflow-engine/routers/events.py`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/epap-project-doc-agent-sop.md`, `docs/rules/axi-workbench-boundary-sop.md`, `scripts/check-workbench-boundaries.mjs`

## Current Work

- TODO: `docs/state/TODO.md`
- Milestone: `docs/state/MILESTONE.md`
- Active: Maintain fresh Web, Mobile and Control Plane verification baselines and delivery evidence
- Active: Advance the product-owned P3 handoff decisions: Web to Mobile, batch semantics and scenario-specific SLA
- Active: Preserve ownership and cross-project boundaries
- Active: Close the remaining external Go API plane gates: ZITADEL OIDC, production SMTP, database fault-injection recovery and cluster deployment
- Known failure: No Kubernetes cluster or production ZITADEL/SMTP credentials are attached to this local workspace; local Mailpit, PostgreSQL RLS and Redis integrations pass, while cluster end-to-end, production SMTP and fault-injection acceptance remain external.
- Active: 2026-10-13 task-3 已合入 dev HEAD: `51e1542b` — fix/m18-doc-cleanup-agent4 12 commits fast-forward 合入 dev

## Troubleshooting

- Symptom: A package command is not found from the repository root.
  Diagnosis: Dependencies are not installed or the target package is outside the current pnpm workspace filter.
  Resolution: Run pnpm install, confirm the package in pnpm-workspace.yaml, and rerun with its package name.
- Symptom: The control-plane snapshot is empty or the smoke fails.
  Diagnosis: Control-plane resource registration or its local source discovery has regressed.
  Resolution: Run the control-plane tests, inspect services/control-plane/src/control-plane.mjs, and validate the configured workspace root.
- Symptom: A cross-layer workflow bypasses the control plane.
  Diagnosis: The six-layer SOP was not followed for entry layer, authority source, downstream access, audit, or rendering.
  Resolution: Re-map the workflow using docs/rules/epap-six-layer-sop.md before changing implementation.

## Decisions And Freshness

- ADR: `docs/adr/0001-zitadel-gin-platform-core.md`
- Changelog: `docs/state/CHANGELOG.md`
- Submit log: `docs/logs/submit/20260611-124603-batch-submit.md`
- Last verified: `2026-10-13`
- Evidence: `Web browser smoke renders the Axi Dashboard shell with shared tabs, breadcrumbs, topbar actions, theme switch, and settings panel.`, `Mobile-app browser smoke renders its own WeChat-style centered header, plus menu, four persistent navigation items, badges, and Scan flow without Web dashboard nodes.`, `Web tests 184/184, UI contract verifier, type-check and production build passed on 2026-09-13; Mobile tests 34/34, UI contract verifier, type-check and production build passed on 2026-09-14; Workbench Foundation type-check passed. The historical Web @axi/ui consumers were removed after confirming they were outside the live AxiDashboardShell render chain; authenticated /admin/handoff history filters status and opens the server-backed detail route; the detail route re-reads current Control Plane project state, fails closed if that read is unavailable, and provides a direct current-project detail entry; paired Mobile /handoffs is restricted to the bearer device actor; pairing QR gateway hints are restricted to private LAN or the first-party HTTPS origin.`, `Control Plane tests 196/196, communication-gateway tests 15/15, workstation contracts tests 6/6, API client type-check, boundary check and 43-resource six-layer smoke passed on 2026-09-14; handoff history filtering, bound Web-owner authorization, linked ApprovalRequest status/expiry revalidation with consistent handoff expiry, lifecycle source-actor/source-owner audit identity, handoffId event projection, rejection, configurable/default-24h expiry (including AXI_HANDOFF_EXPIRY_MS), stoppable expiry worker, external notification enqueue boundary, production fail-closed handling for a missing or development-default gateway internal token, Registry/Graph-only optional resource path resolution, and complete-field normalization for persisted evidence are covered by persistence/audit regression tests.`, `Current browser acceptance passed on 2026-09-13: Web Playwright 25/25 and Mobile Playwright 1/1, including the authenticated handoff detail current-state re-read, desktop shell, legal routes, QR states, responsive boundaries and independent mobile login.`, `Recent delivery-record audit passed 1/1 with `pnpm audit:submit-logs -- --since HEAD~1 --strict`; the prior handoff-owner batch passed 4/4, while 236 historical submit-log coverage gaps and 537 same-batch Changelog evidence gaps remain explicit governance gaps.`, `Go gateway, identity-adapter and platform-core race tests passed with audience/scope validation, OTLP trace export and W3C trace continuation; Helm lint/template, the 2026-09-13 Mailpit SMTP integration check, PostgreSQL RLS integration with dedicated migration/runtime roles, and API Gateway Redis session restart/concurrency integration passed; cluster, real ZITADEL, production SMTP and fault-injection acceptance remain external.`

## Image Resources (Wave B 2026-10-17)

- `scripts/optimize-images.mjs` 新建（cwebp 派生 WebP 兄弟，默认阈值 500KB，purely additive：原 PNG 不删）。
- `scripts/lint-assets.mjs` 新建（守门：`git ls-files` 中 > 500KB 必须有 `.webp` 兄弟，> 200KB 软警告；hard violation 退出码 1）。
- `package.json` 增加 `assets:optimize` 与 `assets:lint` 顶层脚本（仅顶层 monorepo；各 app 的 package.json 各自处理，不在 Wave B 范围）。
- 派生 WebP（cwebp 1.6.0，-q 80 -m 6）首批 top-3：
  - `apps/workbench/public/loading-dango/08-dango-family.png` 1851KB → 67KB（-96.3%）
  - `apps/app-search-system/frontend/public/assets/hero-display.png` 1348KB → 140KB（-89.5%）
  - `apps/axi-coder/public/axi-coder-logo.png` 384KB → 40KB（-89.4%）
- 守门当前状态：扫了 209 tracked 图片，14 hard violations（其中 dango 系列 8 张、`identity-adapter` 邮件资源 1 张、AppIcon 4 张、tauri 图标 1 张），13 soft warnings。后续 Wave 可由 `pnpm assets:lint` 持续跟盯，新图 > 500KB 必须派生 WebP 后才能 commit。
- 不要删除原 PNG（owner 决定是否后续用 `<picture><source srcset=".webp">` 切换）；不要批量跑全 monorepo 单批。

> Generated from `docs/project-docs.manifest.json`; edit the manifest, then regenerate this file.
