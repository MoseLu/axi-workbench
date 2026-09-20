# ADR-005: Agent BFF ownership — merge into Agent Platform FastAPI

**Status:** Accepted on 2026-08-23.
**Decision driver:** block E (BFF/gateway taxonomy + BFF decision) in
`docs/state/TODO.md`.
**Related ADRs:** ADR-006 (gateway taxonomy).

## Context

The Axi Agent Platform frontend (`projects/axi-agent-platform/frontend`)
aggregates dashboard data through a Go service at
`services/agent-bff/cmd/bff/main.go`. As of 2026-08-23:

- The Go BFF listens on a fixed `8081`; the frontend Vite proxy targets the
  Python backend on `8001` (see `frontend/vite.config.ts`). The two are
  disconnected: the frontend never actually reaches the Go BFF.
- The BFF has no `/ready`, no graph node, no DevSvc profile, no
  Compose/Helm entry, and no behavior tests; every Go package reports
  `[no test files]`.
- The Python FastAPI backend at `backend/app/main.py` is the same bounded
  context (Agent Platform) and already serves the Agent backend endpoints.
- The Workbench `services/api-gateway` and the Axi Coder `axi-model-gateway`
  are separate concerns: tenant/identity ingress vs provider/profile
  contract. They are not appropriate owners of dashboard aggregation.

## Decision

**Merge the dashboard aggregation boundary into the Agent Platform FastAPI
service** (path `backend/app/main.py`). Do not retain the Go BFF as a separate
service.

### Rationale

1. **Same bounded context.** The BFF, the Agent backend, the frontend, and
   the data owner are all in `projects/axi-agent-platform`. There is no
   independent data store, no independent auth boundary, no independent
   release cadence that justifies a separate process.
2. **No cross-client reuse.** The BFF currently has exactly one consumer
   (the Agent Platform frontend). Multi-client BFF justification does not
   apply.
3. **Cost of operating two services for one bounded context.** Two ports,
   two health endpoints, two deployment surfaces, two sets of metrics, two
   failure domains — for no observable benefit.
4. **Reject Workbench `api-gateway` as owner.** The Workbench gateway is the
   tenant/identity/Ingress boundary; pulling dashboard aggregation into it
   couples a frontend data layer to a security boundary. Rejected.
5. **Reject independent `axi-gateway` project.** There is no real cross-
   project boundary that justifies a standalone gateway project. Rejected.

### Preserved contract

- `/api/v1/dashboard/stats` request/response DTO is preserved verbatim
  during and after the migration.
- The Go BFF is removed only after the FastAPI replacement is browser-
  verified end-to-end and the Go code is recoverable from Git history.

### Rollback condition

Roll back to the Go BFF if any of the following becomes true:

- A second client (CLI, desktop, mobile, third-party) needs the dashboard
  aggregation independently of the Agent Platform web frontend.
- The dashboard route is moved to a shared service-level gateway boundary
  (Workbench `api-gateway` or a future standalone `axi-gateway`) and the
  Agent Platform FastAPI can no longer host it.
- The Agent Platform's frontend/backend release cadence diverges from the
  FastAPI service's cadence and the aggregation endpoint requires an
  independent release lane.

If rollback occurs, the Go BFF must be re-introduced with `/ready`, graph
node, DevSvc profile, Helm/Compose entry, and at least one behavior test per
package — i.e., the full wire-up that was missing before this ADR.

## Consequences

### Required for completion (block F)

- Port aggregation, timeout, error normalization, SSRF constraints,
  concurrency limits, metrics, and DTO mapping into FastAPI middleware.
- Add route-level and integration tests before deleting the Go BFF.
- Update frontend Vite proxy and Docker/DevSvc commands to target one
  canonical backend (`8001`).
- Remove the standalone Go module only after browser verification.
- Add FastAPI behavior test for frontend → FastAPI →
  `/api/v1/dashboard/stats` that fails if the DTO changes.

### Acceptance criteria

- `pnpm --dir projects/axi-agent-platform build` (frontend) passes.
- `pytest projects/axi-agent-platform/backend` passes; includes a test that
  asserts the `/api/v1/dashboard/stats` DTO.
- Browser smoke test loads the dashboard through the canonical FastAPI
  endpoint with no manual port edits.
- The Go BFF directory is removed or archived; no production deployment
  references it.
