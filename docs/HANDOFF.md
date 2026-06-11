# Axi Workbench Handoff

- Project: `axi-workbench`
- Path: `/Volumes/code/workspace/projects/axi-workbench`
- Owner: `Axi Core Projects`
- Readiness: `verified`
- Purpose: Canonical AxiomaticWorld workbench for the six-layer control plane, dashboard applications, shared contracts, local services, AI integrations, fleet tooling, and app scaffolding.

## 90-Second Read Order

1. `AGENTS.md`
2. `README.md`
3. `docs/rules/epap-six-layer-sop.md`
4. `docs/rules/axi-workbench-boundary-sop.md`
5. `PRD.md`

## Entrypoints

- `apps/web-portal/src/main.tsx`: Primary browser portal for the workbench.
- `services/control-plane/src/server.mjs`: Software-layer control API and managed AgentTask runtime surface.
- `services/communication-gateway/src/server.mjs`: Communication-layer envelope routing and control-plane forwarding.
- `packages/schemas/src/index.ts`: Canonical IMEnvelope, AgentTask, and workstation contract exports.
- `infra/fleet-console/scripts/fleetctl.py`: Physical-service inventory and validation CLI.

## Commands

- Setup: `pnpm install`
- Start: `pnpm dev`
- Start: `pnpm dev:web`
- Start: `pnpm --filter @axi/workstation-control-plane start`
- Start: `pnpm --filter @axi/workstation-communication-gateway start`
- Health: `pnpm --filter @axi/workstation-control-plane smoke`
- Health: `python3 infra/fleet-console/scripts/fleetctl.py validate`
- Verify: `pnpm type-check`
- Verify: `pnpm test`
- Verify: `pnpm test:workstation`
- Verify: `pnpm --dir apps/devsvc-dashboard typecheck`
- Verify: `pnpm --dir apps/axi-coder typecheck`
- Verify: `npm --prefix apps/verification-inbox run typecheck`
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

- Provides: `IMEnvelope and AgentTask schemas`, `Six-layer control-plane resource snapshots`, `Communication gateway routing`, `Axi Dashboard application surfaces`, `Axi App CLI scaffolding`
- Consumes: `Axi Agent Platform API when AXI_AGENT_PLATFORM_URL is configured`, `CC-Connect memory database`, `Codex CLI or Codex app-server runtime`, `Local infrastructure services declared in docker-compose.yml`
- Contract files: `packages/schemas/src/index.ts`, `services/control-plane/src/control-plane.mjs`, `services/communication-gateway/src/gateway.mjs`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/epap-project-doc-agent-sop.md`, `docs/rules/axi-workbench-boundary-sop.md`, `scripts/check-workbench-boundaries.mjs`

## Current Work

- TODO: `TODO.md`
- Milestone: `MILESTONE.md`
- Active: Keep the root documentation suite current
- Active: Align verification commands with the real project stack
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
- Changelog: `CHANGELOG.md`
- Submit log: `docs/logs/submit/20260611-124603-batch-submit.md`
- Last verified: `2026-06-11`
- Evidence: `Control-plane smoke exited 0 on 2026-06-11.`, `Snapshot contained 35 resources across im, communication, software, base_service, physical_service, and external_capability layers.`

> Generated from `docs/project-docs.manifest.json`; edit the manifest, then regenerate this file.
