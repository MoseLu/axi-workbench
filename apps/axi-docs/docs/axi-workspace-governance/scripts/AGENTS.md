<!-- Layer: 3 | Agents | Module: scripts -->
<!-- Parent Architecture: ../.claude/ARCHITECTURE.md -->
<!-- Updated: 2026-06-10 -->

# Workspace Scripts Agent Instructions

## Responsibility

`scripts/` owns workspace-level CLIs and wrappers for project lookup, service
management, alerts, topology, and Node runtime selection. Scripts must remain
small, inspectable, and safe to run from the workspace root.

The workspace root is not a git repository or code ownership unit. Treat this
directory as a launcher surface: durable implementation changes belong in the
owning project repository or `foundation/workspace-governance`, with root shims
kept minimal.

## Layout (post 2026-06-10 reorganization)

| Subdirectory | Owns | Invariants |
| --- | --- | --- |
| `runtime/` | Node 22 wrapper and runtime setup (`run-node22-command.sh`, `setup-node22-runtime.sh`) | No internal cross-imports; sourced from shell. |
| `service/devsvc/` | PM2-backed dev service cluster (`devsvc`, `devsvc-lib.mjs`, `devsvc-runner.mjs`, `devsvc-dashboard.mjs`, `devsvc-proxy.mjs`, `devsvc-domain-gateway.mjs`, `devsvc-domain-runner.mjs`, `devsvc-alert-lib.mjs`, `devsvc-alert-watch.mjs`, `devsvc-topology-lib.mjs`) | All cross-file imports stay relative within this directory; do not reach back into `scripts/governance`. |
| `governance/` | Workspace graph and project catalog queries (`workspace-project`, `workspace-project-mcp`) | Reads `workspace.graph.json` and `foundation/workspace-governance/scripts/workspace-completion.mjs` via relative `../../infra/...` paths. |
| `utility/` | Reserved for ad-hoc helpers. Currently empty (`.keep`). | Add standalone tools here; never import from `service/devsvc/` (one-way dependency). |

## Cross-Layer Dependency Direction

```
service/devsvc/*  ──depends on──>  ./devsvc-lib.mjs (internal)
governance/workspace-project     ──depends on──>  ../../foundation/workspace-governance/...
runtime/*.sh                     ──no JS dependencies
utility/*                        ──must not import from service/ or governance/
```

## Local Rules

- Scripts must not hard-code secrets.
- Prefer read-only diagnostics before state-changing service commands.
- Keep destructive behavior behind explicit command names and clear output.
- Use `workspace.graph.json` and `dev-services.config.json` as data sources;
  do not fork their state into scripts.
- For Node scripts, keep dependencies limited to available runtime modules unless
  a package-level dependency is intentionally introduced.
- When adding a new script, decide the layer first (runtime / service / governance / utility)
  and put it in the matching subdirectory. Flat placement at `scripts/` is forbidden.

## Verification

- Syntax check edited Node scripts with `node --check <script>`.
- Validate graph-facing changes with `node /Volumes/code/workspace/scripts/governance/workspace-project validate`.
- Validate service-facing changes with `node /Volumes/code/workspace/scripts/service/devsvc/devsvc doctor core`.
- Re-run the root `make doctor` after structural changes.

<!-- MANUAL: scripts-specific instructions preserved across updates -->
