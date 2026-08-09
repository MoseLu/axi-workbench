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

- Status: Delivered — P0–P5 implemented on 2026-08-09
- Evidence: `CAPABILITY-INVENTORY.json` records 17 current Web/Mobile/Host capability groups and is enforced by `pnpm check:capabilities`; Web navigation is grouped by control object, its `运行状态` and `工作项` surfaces consume the Control Plane projection, and generic desktop scanning is excluded; Mobile projects, workspace and search consume the authenticated Control Plane projection and never fall back to static business data; `ApprovalScanPreview` / `MobileApprovalDecision` / `HandoffContext` contracts, Gateway proxying, Control Plane audit tests and `/admin/handoff/:id` implement C/D continuation; DevSvc hosted specialist entries declare Owner, authorization, audit and fallback.
- Exit criteria: Met for this batch. New user-facing work now updates the machine-checked inventory and retains separate Web/Mobile browser acceptance, Gateway/Control Plane policy tests, and host execution-boundary metadata.

## Milestone 1: Documentation Baseline

- Status: Completed
- Evidence: `README.md`, `README.zh-CN.md`, `AGENTS.md`, `INDEX.md`, `CHANGE.md`, `docs/state/CHANGELOG.md`, `docs/state/TODO.md`, `docs/state/MILESTONE.md`, `docs/state/PRD.md`, `docs/state/TDD.md`, `docs/state/VERIFICATION.md` exist and cross-reference each other through `REQ-*` IDs.
- Exit criteria: every required document exists, the minimum documentation check in `TDD.md` passes, and `docs/project-docs.manifest.json` is at v2.

## Milestone 2: Verification Alignment

- Status: In progress
- Evidence: P0–P5 now have concrete type, unit, API, schema, gateway, host, contract, boundary and browser checks; the latest 2026-08-09 delivery records a signed-in 1280×720 desktop Web browser observation and a 390px Mobile observation in `VERIFICATION.md`. `packages/workbench-foundation` still owns only shared session and locale behavior.
- Exit criteria: every P0/P1 TODO item has at least one concrete test command line, and each REQ has both an `Acceptance Criteria` row in `PRD.md` and a matching test in `TDD.md` / `TODO.md`.

## Milestone 3: Operational Handoff

- Status: In progress
- Evidence: `docs/HANDOFF.md` 90-second read order uses AGENTS → README → six-layer SOP → boundary SOP → PRD; `CHANGELOG.md` records the multi-surface implementation and `VERIFICATION.md` contains refreshed browser evidence. A Mobile-to-Web handoff now persists source, target and final action under one correlation id.
- Exit criteria: CHANGELOG records the doc refresh, `docs/state/VERIFICATION.md` carries the latest browser evidence, and there is no "next milestone" line in production contracts.

## Milestone 4: Six-Layer Discipline

- Status: Planned
- Evidence: `docs/rules/epap-six-layer-sop.md` is enforced by `pnpm check:boundaries`, and `services/control-plane` + `services/communication-gateway` declare the entry / authority / downstream / renderer / audit / verification path for every new flow.
- Exit criteria: every service change enters the merge queue with a SOP-aligned declaration, and no regression on the six-layer smoke.
