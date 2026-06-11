# TODO

Tasks are grouped by inferred requirements. P0/P1 items include test cases.

## P0

- [ ] REQ-DOC-001: Keep the root documentation suite complete and current.
  - Test: verify `README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md` exist in `/Volumes/code/workspace/projects/axi-workbench`.
  - Test: run `rg -n "REQ-DOC-001|PRD|TDD|Milestone" README.md PRD.md TDD.md MILESTONE.md INDEX.md`.

## P1

- [ ] REQ-VERIFY-001: Keep verification commands accurate for the real project stack.
  - Test: run the commands listed in `TDD.md` or document the blocker in `CHANGELOG.md`.

- [ ] REQ-BOUNDARY-001: Preserve ownership and cross-project boundaries.
  - Test: review `AGENTS.md` before broad edits and confirm no generated caches or external sources were edited.

## P2

- [ ] REQ-DOC-002: Add deeper module docs only where source ownership and repeated workflows justify them.
- [ ] REQ-MILESTONE-001: Update `MILESTONE.md` after each verified delivery batch.

## Zero-context handoff governance

### Completed — Migrate the project docs manifest to v2

- **Problem:** The v1 manifest listed documents but did not expose the workbench's real entrypoints, six-layer contracts, runtime commands, environment dependencies, active milestones, or fresh smoke evidence.
- **Solution:** Upgrade `docs/project-docs.manifest.json` to version 2 from repository-local guidance, package scripts, control-plane sources, workspace packages, TODOs, milestones, and docs SOPs.
- **Expected result:** A zero-context agent can enter the canonical workbench, select the correct layer and entrypoint, run the smallest safe command, and identify contract and ownership boundaries without broad rediscovery.
- **Acceptance:** The manifest contains every v2 onboarding field, parses as JSON, points only to project-local files, contains no secret values, and marks the project verified only after a safe smoke succeeds.
- **Evidence:** `docs/project-docs.manifest.json`; `pnpm --filter @axi/workstation-control-plane smoke` exited 0 with a 35-resource six-layer snapshot on 2026-06-11.
- **Dependencies:** `AGENTS.md`, `README.md`, `docs/rules/epap-six-layer-sop.md`, `docs/rules/epap-project-doc-agent-sop.md`, package manifests, and control-plane sources.
- **Status:** Completed on 2026-06-11.

### Ongoing — Keep zero-context evidence fresh

- **Problem:** Monorepo package moves, new dashboard apps, service contracts, environment variables, and six-layer ownership changes can make onboarding facts stale quickly.
- **Solution:** Update the v2 manifest whenever entrypoints, package scripts, contracts, required services, ownership, TODO priorities, milestones, or verification behavior changes.
- **Expected result:** Future agents can use one current manifest to choose the correct subtree guidance and verification lane.
- **Acceptance:** Each relevant change updates `updated`, `currentWork`, `contracts`, and `verification`; verified status requires a fresh safe smoke; TODO, milestone, and changelog remain consistent.
- **Evidence:** Fresh smoke output in `verification.evidence`, JSON/path checks, and a matching `CHANGELOG.md` entry.
- **Dependencies:** Owners of `apps/`, `services/`, `packages/`, `ai/`, `infra/`, `prompts/`, and `tools/`.
- **Status:** Ongoing.
