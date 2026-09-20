# ADR-006: Gateway / BFF taxonomy and ownership map

**Status:** Accepted on 2026-08-23.
**Decision driver:** block E (GATEWAY-TAXONOMY-001) in `docs/state/TODO.md`.
**Related ADRs:** ADR-005 (Agent BFF ownership), ADR-001 (governance repo as
index plane).

## Context

The Axi workspace has at least five distinct "gateway-like" services. They
must not be conflated. As of 2026-08-23 the boundaries are:

| Service | Path | Role | Owner |
|---|---|---|---|
| Workbench API Gateway | `projects/axi-workbench/services/api-gateway` | Tenant, identity, ingress, downstream service boundary. Business API. | `axi-workbench` |
| Axi Coder Model Gateway | `projects/axi-workbench/apps/axi-coder` (`axi-model-gateway` contract) | Provider / profile / local proxy contract; AI capability routing. | `axi-workbench` (Axi Coder sub-app) |
| Workbench Communication Gateway | `projects/axi-workbench/services/communication-gateway` | Message envelope and control-plane transport boundary. | `axi-workbench` |
| Agent Platform BFF | `projects/axi-agent-platform/services/agent-bff` | Dashboard aggregation boundary. **To be merged into Agent Platform FastAPI per ADR-005.** | `axi-agent-platform` |
| DevSvc Domain Gateway | `dev-services.config.json` `service_profiles[*].gateway` | Local domain / NATAPP gateway for development. **Not a business API.** | governance (`infra/axi-workspace-governance`) |

## Decision

Each of the five rows above is a distinct, named, owned boundary. No new
project called `axi-gateway` will be admitted unless a real cross-project
business boundary emerges that none of the above can serve.

### Naming rules

- **Project name** must equal the bounded context: `axi-workbench`,
  `axi-agent-platform`, `axi-coder`, etc.
- **Sub-service** within a project uses the directory name as the service
  id (e.g. `services/api-gateway`).
- **Contract alias** may exist in `workspace.graph.json` for documentation
  but does not create a separate project (e.g. `axi-model-gateway` is a
  contract inside `axi-workbench`, not a project).

### What does NOT count as a gateway project

- A DevSvc profile entry that maps a local port to a public URL.
- A shared-UI package that exposes a single fetcher.
- A cron / worker that writes to a database.
- A documentation mirror with no runtime surface.

### What DOES justify a new project

- An independent data owner.
- An independent auth / tenant boundary.
- An independent release cadence.
- An independent failure domain observable from another project's health
  check.

If only one of those four is true, prefer a sub-service inside the owning
project. Only when two or more are true should a new project be admitted.

## Consequences

- `workspace.graph.json` keeps `axi-model-gateway` as a contract inside
  `axi-coder`, not as a project. See ADR-007 for the ID/path alias contract.
- Any new service file in a project that contains "gateway" or "bff" in its
  path must reference this ADR in its README.
- The DevSvc gateway (`dev-services.config.json`) is operational tooling,
  not a project. It is audited by `workspace-audit.mjs` as part of the
  governance surface, but it is not registered in `workspace.graph.json`.

## Acceptance criteria

- `workspace.graph.json` has exactly one entry per business boundary in the
  table above.
- No document claims that an independent `axi-gateway` project exists
  unless this ADR is amended.
- The BFF ownership path (ADR-005) terminates in `axi-agent-platform`'s
  FastAPI service; the Go BFF service directory is archived.
