# Axi Workbench Handoff

- Project: `axi-workbench`
- Path: `/Volumes/code/workspace/projects/axi-workbench`
- Owner: `Axi Core Projects`
- Readiness: `verified`
- Purpose: Canonical AxiomaticWorld workbench for the six-layer control plane: a Web Axi Dashboard application and a separate WeChat-style mobile application, shared contracts, local services, AI integrations, fleet tooling, and app scaffolding.

## 90-Second Read Order

1. `AGENTS.md`
2. `README.md`
3. `docs/rules/epap-six-layer-sop.md`
4. `docs/rules/axi-workbench-boundary-sop.md`
5. `docs/state/PRD.md`

## Entrypoints

- `apps/workbench/src/main.tsx`: Independent Web admin application: Axi Dashboard Chrome, sidebar, topbar plugins, tabs, breadcrumbs, settings, and Web-only pages.
- `apps/workbench-mobile/src/main.tsx`: Independent WeChat-style mobile application: its own Vite entry, centered header, search/plus menu, overview/project/workspace/scan/me tab bar, badges, scan flow, login, and page composition.
- `packages/workbench-foundation/src/index.ts`: Shared auth-session and locale-preference foundation for the independent user applications; no page or layout exports.
- `services/control-plane/src/server.mjs`: Software-layer control API and managed AgentTask runtime surface.
- `services/communication-gateway/src/server.mjs`: Communication-layer envelope routing and control-plane forwarding.
- `packages/schemas/src/index.ts`: Canonical IMEnvelope, AgentTask, and workstation contract exports.
- `infra/fleet-console/scripts/fleetctl.py`: Physical-service inventory and validation CLI.

## Commands

- Setup: `pnpm install`
- Start: `pnpm dev:workbench`
- Start: `pnpm dev:mobile`
- Start: `pnpm --filter @axi/workstation-control-plane start`
- Start: `pnpm --filter @axi/workstation-communication-gateway start`
- Health: `pnpm --filter @axi/workstation-control-plane smoke`
- Health: `python3 infra/fleet-console/scripts/fleetctl.py validate`
- Verify: `pnpm --filter @epap/api-client --filter @axi/workbench-foundation --filter @axi/workbench --filter @axi/workbench-mobile type-check`
- Verify: `pnpm --filter @axi/workbench --filter @axi/workbench-mobile test`
- Verify: `pnpm --filter @axi/workbench --filter @axi/workbench-mobile build`
- Verify: `node apps/workbench/scripts/verify-ui-contracts.mjs`
- Verify: `pnpm --filter @axi/workbench-mobile verify:contracts`
- Verify: `pnpm check:boundaries`
- Smoke: `pnpm --filter @axi/workstation-control-plane smoke`

## Environment

- Runtimes: `Node.js >=18`, `pnpm >=8`, `TypeScript`, `Go`, `Python`, `Java`
- Services: `Control Plane`, `Communication Gateway`, `PostgreSQL`, `Redis`, `Kafka`, `Qdrant`, `MinIO`, `Prometheus`, `Grafana`, `Jaeger`
- `AXI_WORKSTATION_ROOT`: required=no, secret=no, source=control-plane environment
- `AXI_WORKSTATION_CONTROL_CACHE_DIR`: required=no, secret=no, source=control-plane environment
- `CC_CONNECT_MEMORY_DATABASE_URL`: required=no, secret=yes, source=local credentials or service environment
- `CODEX_BIN`: required=no, secret=no, source=control-plane environment
- `AXI_AGENT_PLATFORM_URL`: required=no, secret=no, source=control-plane environment
- `CONTROL_PLANE_PORT`: required=no, secret=no, source=control-plane environment
- `AXI_WORKSTATION_CONTROL_PLANE_URL`: required=no, secret=no, source=communication-gateway environment
- `COMMUNICATION_GATEWAY_PORT`: required=no, secret=no, source=communication-gateway environment

## Contracts

- Provides: `IMEnvelope and AgentTask schemas`, `Six-layer control-plane resource snapshots`, `Communication gateway routing`, `Axi Dashboard application surfaces`, `Independent Web admin and mobile workbench applications`, `Shared Workbench auth-session and locale foundation`, `Axi App CLI scaffolding`
- Consumes: `Axi Agent Platform API when AXI_AGENT_PLATFORM_URL is configured`, `CC-Connect memory database`, `Codex CLI or Codex app-server runtime`, `Local infrastructure services declared in docker-compose.yml`
- Contract files: `packages/schemas/src/index.ts`, `packages/workbench-foundation/src/index.ts`, `apps/workbench/src/layouts/MainLayout.tsx`, `apps/workbench-mobile/src/layouts/MobileShell.tsx`, `services/control-plane/src/control-plane.mjs`, `services/communication-gateway/src/gateway.mjs`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/epap-project-doc-agent-sop.md`, `docs/rules/axi-workbench-boundary-sop.md`, `scripts/check-workbench-boundaries.mjs`

## Current Work

- TODO: `docs/state/TODO.md`
- Milestone: `docs/state/MILESTONE.md`
- Active: Keep the root documentation suite current
- Active: Align verification commands with the real project stack
- Active: Keep Web Axi Dashboard Chrome and WeChat-style mobile composition independent
- Active: Preserve ownership and cross-project boundaries
- Active: Complete the operational handoff milestone
- Known failure: The root AGENTS.md still describes the pre-v2 manifest as legacy and should be reconciled in a separately authorized guidance update.

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

- ADR: `docs/rules/epap-six-layer-sop.md`
- Changelog: `docs/state/CHANGELOG.md`
- Submit log: `docs/logs/submit/20260611-124603-batch-submit.md`
- Last verified: `2026-08-07`
- Evidence: `Web browser smoke renders the Axi Dashboard shell with shared tabs, breadcrumbs, topbar actions, theme switch, and settings panel.`, `Mobile-app browser smoke renders its own WeChat-style centered header, plus menu, five-tab green navigation, badges, and scan flow without Web dashboard nodes.`, `Web and mobile UI contract verifiers, TypeScript, unit tests, and production builds passed on 2026-08-07.`

> Generated from `docs/project-docs.manifest.json`; edit the manifest, then regenerate this file.
