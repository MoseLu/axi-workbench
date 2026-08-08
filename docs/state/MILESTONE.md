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

- Status: Defined — implementation not started
- Evidence: `docs/state/PRD.md` defines `REQ-POSITION-001`, `REQ-ARCH-001`, `REQ-ACTION-001`, `REQ-REFERENCE-001`, `REQ-SURFACE-001`, `REQ-WEB-001`, `REQ-WEB-002`, `REQ-MOBILE-001`, `REQ-MOBILE-002`, `REQ-CROSS-001`, `REQ-SCAN-001` and `REQ-DELIVERY-001`: Web control-center, Mobile role-execution and professional-tool roles; A/B/C/D action policy; distinct scan semantics; the current four-item Mobile navigation baseline; and the P0–P5 delivery path. `docs/specs/2026-08-09-multi-surface-admin-positioning/MARKET-REFERENCE.md` records bounded official public-product references, while the change directory captures design, task boundary and capability/action-policy template.
- Exit criteria: a full, auditable inventory (not only the baseline examples in `CAPABILITY-OWNERSHIP.md`) classifies every current user-facing capability by role, execution surface Owner and action level; Web control-center and Mobile execution flows have separately reviewed acceptance scenarios; each dual-surface flow has server-side action policy, authorization/audit and a context-preserving handoff rule.

## Milestone 1: Documentation Baseline

- Status: Completed
- Evidence: `README.md`, `README.zh-CN.md`, `AGENTS.md`, `INDEX.md`, `CHANGE.md`, `docs/state/CHANGELOG.md`, `docs/state/TODO.md`, `docs/state/MILESTONE.md`, `docs/state/PRD.md`, `docs/state/TDD.md`, `docs/state/VERIFICATION.md` exist and cross-reference each other through `REQ-*` IDs.
- Exit criteria: every required document exists, the minimum documentation check in `TDD.md` passes, and `docs/project-docs.manifest.json` is at v2.

## Milestone 2: Verification Alignment

- Status: In progress
- Evidence: Web and mobile application type-check / test / build / contract-verifier lanes are maintained separately; `packages/workbench-foundation` owns the shared session and locale boundary; `pnpm --filter @axi/workstation-control-plane smoke` continues to exit 0 with ≥ 35 resources across six layers (last verified 2026-06-11).
- Exit criteria: every P0/P1 TODO item has at least one concrete test command line, and each REQ has both an `Acceptance Criteria` row in `PRD.md` and a matching test in `TDD.md` / `TODO.md`.

## Milestone 3: Operational Handoff

- Status: In progress
- Evidence: `docs/HANDOFF.md` 90-second read order uses AGENTS → README → six-layer SOP → boundary SOP → PRD; the v2 manifest points to a fresh smoke; CHANGELOG records the 2026-08-07 PRD/TDD/TODO refresh.
- Exit criteria: CHANGELOG records the doc refresh, `docs/state/VERIFICATION.md` carries the latest browser evidence, and there is no "next milestone" line in production contracts.

## Milestone 4: Six-Layer Discipline

- Status: Planned
- Evidence: `docs/rules/epap-six-layer-sop.md` is enforced by `pnpm check:boundaries`, and `services/control-plane` + `services/communication-gateway` declare the entry / authority / downstream / renderer / audit / verification path for every new flow.
- Exit criteria: every service change enters the merge queue with a SOP-aligned declaration, and no regression on the six-layer smoke.
