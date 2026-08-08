# Axi Workbench Handoff

- Project: `axi-workbench`
- Path: `/Volumes/code/workspace/projects/axi-workbench`
- Owner: `Axi Core Projects`
- Readiness: `verified`
- Purpose: Canonical AxiomaticWorld multi-surface admin workbench: Web is the complete backend-management primary surface and Mobile is the auxiliary management surface, backed by the six-layer control plane, Go API plane, shared contracts, local services, AI integrations, fleet tooling, and app scaffolding.

## 90-Second Read Order

1. `AGENTS.md`
2. `README.md`
3. `docs/rules/epap-six-layer-sop.md`
4. `docs/rules/axi-workbench-boundary-sop.md`
5. `docs/state/PRD.md`

## Entrypoints

- `docs/architecture/source-catalog.md`: Canonical physical source topology: application roles, runtime boundaries, root workspace membership, host registration, and cleanup order.
- `apps/workbench/src/main.tsx`: Independent Web backend-management primary application: Axi Dashboard Chrome, sidebar, topbar plugins, tabs, breadcrumbs, settings, high-density management and Web-only pages.
- `apps/workbench-mobile/src/main.tsx`: Independent mobile auxiliary-management application: its own Vite entry, centered header, search/plus menu, four persistent Home/Projects/Workspace/Me navigation items, a Scan action, badges, login, and mobile page composition.
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
- Verify: `pnpm --filter @epap/api-client --filter @axi/workbench-foundation --filter @axi/workbench --filter @axi/workbench-mobile type-check`
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
- `CONTROL_PLANE_PORT`: required=no, secret=no, source=control-plane environment
- `AXI_WORKSTATION_CONTROL_PLANE_URL`: required=no, secret=no, source=communication-gateway environment
- `COMMUNICATION_GATEWAY_PORT`: required=no, secret=no, source=communication-gateway environment

## Contracts

- Provides: `IMEnvelope and AgentTask schemas`, `Six-layer control-plane resource snapshots`, `Communication gateway routing`, `Axi Dashboard application surfaces`, `Independent Web admin and mobile workbench applications`, `Shared Workbench auth-session and locale foundation`, `ZITADEL-backed OIDC and PKCE business API boundary`, `Tenant-aware platform core with PostgreSQL RLS and transactional outbox`, `Axi App CLI scaffolding`
- Consumes: `Axi Agent Platform API when AXI_AGENT_PLATFORM_URL is configured`, `CC-Connect memory database`, `Codex CLI or Codex app-server runtime`, `Local infrastructure services declared in docker-compose.yml`
- Contract files: `packages/schemas/src/index.ts`, `packages/workbench-foundation/src/index.ts`, `apps/workbench/src/layouts/MainLayout.tsx`, `apps/workbench-mobile/src/layouts/MobileShell.tsx`, `services/api-gateway/cmd/gateway/main.go`, `services/identity-adapter/cmd/identity-adapter/main.go`, `services/platform-core/cmd/platform-core/main.go`, `infra/helm/axi-workbench-platform/Chart.yaml`, `docs/adr/0001-zitadel-gin-platform-core.md`, `services/control-plane/src/control-plane.mjs`, `services/communication-gateway/src/gateway.mjs`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/epap-project-doc-agent-sop.md`, `docs/rules/axi-workbench-boundary-sop.md`, `scripts/check-workbench-boundaries.mjs`

## Current Work

- TODO: `docs/state/TODO.md`
- Milestone: `docs/state/MILESTONE.md`
- Active: Align verification commands with the real project stack
- Active: Implement the multi-surface admin product contract: Web primary, Mobile auxiliary; reconcile capability ownership and navigation terminology while keeping the two app compositions independent
- Active: Preserve ownership and cross-project boundaries
- Active: Complete Go API plane cluster integration: ZITADEL OIDC, Mailpit/SMTP, PostgreSQL/Redis fault recovery and Helm deployment
- Known failure: The root AGENTS.md still describes the pre-v2 manifest as legacy and should be reconciled in a separately authorized guidance update.
- Known failure: No Kubernetes cluster or production ZITADEL/SMTP credentials are attached to this local workspace; cluster end-to-end acceptance remains external.

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
- Last verified: `2026-08-07`
- Evidence: `Web browser smoke renders the Axi Dashboard shell with shared tabs, breadcrumbs, topbar actions, theme switch, and settings panel.`, `Mobile-app browser smoke renders its own WeChat-style centered header, plus menu, four persistent navigation items, badges, and Scan flow without Web dashboard nodes.`, `Web and mobile UI contract verifiers, TypeScript, unit tests, and production builds passed on 2026-08-07.`, `Go gateway, identity-adapter and platform-core race tests passed with audience/scope validation, OTLP trace export and W3C trace continuation; Helm lint/template passed; required local Mailpit SMTP delivery passed; an isolated PostgreSQL migration/runtime-role integration test proved direct owner-downgrade and cross-tenant denial on 2026-08-07.`

> Generated from `docs/project-docs.manifest.json`; edit the manifest, then regenerate this file.
