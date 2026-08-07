# Axi Workbench TDD

## Architecture Assumptions

- Root path: `/Volumes/code/workspace/projects/axi-workbench`.
- Canonical entrypoint: `apps/workbench/src/main.tsx` — single SPA serving desktop Web (Axi Dashboard Chrome, viewport ≥ 768px) and mobile Web (independent mobile shell, viewport < 768px).
- Stack signals: Node ≥ 18, pnpm ≥ 8, TypeScript, Vite, Turborepo, Go, Java Spring Boot, Python FastAPI, LangChain, Qdrant, RAG.
- Six-layer control plane is enforced by `docs/rules/epap-six-layer-sop.md`. The TDD treats those boundaries as load-bearing and writes tests around them.
- Top-level layout:
  - `apps/`: 6 dashboard apps — `workbench`, `devsvc-dashboard`, `axi-coder`, `verification-inbox`, `app-search-system`, `ollama-menu-assistant`.
  - `services/`: 8 services — `api-gateway`, `auth-service`, `core-service`, `file-service`, `notification-service`, `communication-gateway`, `control-plane`, `workflow-engine`.
  - `packages/`: `api-client`, `axi-rag`, `schemas`, `epap-schemas-compat` (`@epap/schemas` migration shim), `types`, `ui` (legacy), `utils`.
  - `tools/axi-app-cli/`: independent sub-monorepo, governed by its own `AGENTS.md`.
  - `ai/`, `backend/`, `infra/fleet-console/`, `prompts/`, `docs/`.
- Root scripts (`package.json`): `pnpm install`, `pnpm dev`, `pnpm dev:workbench`, `pnpm dev:dashboard`, `pnpm dev:coder`, `pnpm build`, `pnpm build:workbench`, `pnpm build:schemas`, `pnpm test`, `pnpm test:workstation`, `pnpm type-check`, `pnpm lint`, `pnpm check:boundaries`, `pnpm clean`, `pnpm clean:cache`.

## Technical Design

The root docs form a single source of truth plus a runtime-enforced test plan:

1. `AGENTS.md` defines agent-safe boundaries, project boundaries, six-layer SOP, and cross-project ground rules.
2. `PRD.md` defines requirements, non-goals, and success metrics.
3. `TDD.md` (this file) defines the verification strategy and concrete commands per surface.
4. `docs/state/TODO.md` maps requirements (`REQ-*`) to tasks and tests.
5. `docs/state/MILESTONE.md` records delivery evidence and exit criteria.
6. `INDEX.md` maps documents and source-of-truth ownership.
7. `docs/state/CHANGELOG.md` + `docs/logs/submit/<batch-id>.md` form the immutable change trail.
8. `docs/project-docs.manifest.json` (v2) is the zero-context onboarding contract regenerated from the above.

### Test Surface Map

| Surface | Owner | Verification entry |
| --- | --- | --- |
| Workbench UI (desktop + mobile shell) | `apps/workbench` | `pnpm --filter @axi/workbench type-check`, `pnpm --filter @axi/workbench test`, `pnpm --filter @axi/workbench build`, `node apps/workbench/scripts/verify-ui-contracts.mjs` |
| Workbench contract verifier | `apps/workbench/scripts/verify-ui-contracts.mjs` | Same as above |
| Workstation control plane | `services/control-plane` | `pnpm --filter @axi/workstation-control-plane test`, `pnpm --filter @axi/workstation-control-plane smoke` |
| Communication gateway | `services/communication-gateway` | `pnpm --filter @axi/workstation-communication-gateway test` |
| Workstation contracts | `packages/schemas` | `pnpm --filter @axi/workstation-contracts test` |
| Desktop host | `apps/devsvc-dashboard` | `pnpm --dir apps/devsvc-dashboard typecheck` |
| Axi Coder | `apps/axi-coder` | `pnpm --dir apps/axi-coder typecheck` |
| Verification Inbox | `apps/verification-inbox` | `npm --prefix apps/verification-inbox run typecheck` |
| Fleet Console (Python) | `infra/fleet-console` | `python3 infra/fleet-console/scripts/fleetctl.py validate` |
| Boundary SOP | `scripts/check-workbench-boundaries.mjs` | `pnpm check:boundaries` |
| Workspace graph | workspace governance | `node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate` |

## Verification Commands

### Default zero-context path

```bash
# 1) Bootstrap
pnpm install

# 2) Workspace graph + boundaries
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate
pnpm check:boundaries

# 3) Whole-repo default checks
pnpm type-check
pnpm test
pnpm test:workstation

# 4) Workbench end-to-end (UI contracts + type-check + tests + build)
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench build
node apps/workbench/scripts/verify-ui-contracts.mjs

# 5) Control-plane smoke + Fleet Console validate
pnpm --filter @axi/workstation-control-plane smoke
python3 infra/fleet-console/scripts/fleetctl.py validate
```

### Surface-specific commands

```bash
# Dashboard host
pnpm --dir apps/devsvc-dashboard typecheck

# Axi Coder
pnpm --dir apps/axi-coder typecheck

# Verification Inbox (npm prefix by design)
npm --prefix apps/verification-inbox run typecheck
```

### Documentation minimum check

```bash
for f in README.md README.zh-CN.md AGENTS.md INDEX.md CHANGE.md \
         docs/state/CHANGELOG.md docs/state/TODO.md docs/state/MILESTONE.md \
         docs/state/PRD.md docs/state/TDD.md docs/state/VERIFICATION.md; do
  test -f "/Volumes/code/workspace/projects/axi-workbench/$f" || { echo "MISSING $f"; exit 1; }
done
rg -n "REQ-(DOC|VERIFY|BOUNDARY|CONTROLPLANE|COMMUNICATION|WORKBENCH|MILESTONE|LOG|AXI-CODER|MOBILE)" \
  docs/state/PRD.md docs/state/TDD.md docs/state/TODO.md docs/state/MILESTONE.md docs/state/CHANGELOG.md
```

## Risk Cases

- Documentation drifts from package manifests or the current source layout.
- Agents edit outside `/Volumes/code/workspace/projects/axi-workbench` without explicit scope and accidentally mutate governance or neighbor projects.
- Reference checkouts (`references/*`, `infra/axi-workspace-governance/references/*`) are mistaken for Axi Workbench-owned product surfaces.
- Verification commands become stale after dependency or layout changes (e.g. a deprecated package.json script stays in TDD).
- Workbench starts importing neighboring project implementations instead of consuming `@axi/workstation-*` package / API / config contracts.
- The desktop host (`devsvc-dashboard`) becomes a second user portal instead of a host shell.
- `apps/web-portal` is reintroduced as a Web entry, defeating `REQ-WORKBENCH-001`.
- Axi Coder regresses to hard-coded Axi Notify artifact paths, breaking `REQ-AXI-CODER-001`.
- Six-layer SOP is bypassed: control-plane direct file IO, communication-gateway calling Codex, IM adapter reading project tree.
- Workbench UI contract verifier is skipped, allowing shared dashboard chrome leaks into the mobile shell or vice versa.
- React Router v7 future-flag warnings hide genuine console errors; tests must distinguish them.

## Test Strategy

- Treat `PRD.md` requirements as test contracts; every `REQ-*` must appear in `TDD.md` or `TODO.md` with at least one command/check.
- Prefer existing project test/build commands; never invent a parallel test runner.
- Run `pnpm check:boundaries` for any control-plane, dashboard-hosting, cross-project, or package dependency change.
- For doc-only changes, run the minimum documentation check above and inspect diffs for placeholder language or stale REQ IDs.
- Run workbench UI contract verifier + 23 unit tests + production build for every `apps/workbench/**` change.
- Capture every batch in `docs/logs/submit/<batch-id>.md` and link it from `docs/state/CHANGELOG.md`.
- Keep `pnpm --filter @axi/workstation-control-plane smoke` exit-code 0 and ≥ 35 resources across six layers; treat smoke regression as a P0 incident.
- Mobile and desktop smoke must be regenerated whenever `apps/workbench/src/**`, `packages/ui/**`, `@axi/workstation-*` shared chrome tokens, or viewport-aware routing change.
- A failing boundary SOP or six-layer SOP is treated as P0 and blocks merge regardless of green tests.
