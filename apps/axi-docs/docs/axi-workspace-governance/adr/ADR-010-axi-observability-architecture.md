---
id: adr-workspace-010
title: ADR-010: Axi Observability Architecture
type: reference
status: Accepted
tags: [workspace, adr, observability, logging, metrics, tracing]
created: 2026-09-24
modified: 2026-09-25
agent-readable: true
---

# ADR-010: Axi Observability Architecture

## Status

Accepted on 2026-09-24.

## Context

The Axi workspace contains 17 active projects across Python, Go, Node.js,
Android, and browser stacks. Each project independently invents logging:

- `foundation/axi-{kernel,workbench-cli,sync,inbox,runtime,apps}` Python CLIs
  use bare `print(..., file=sys.stderr)`.
- Go services mix `log/slog` (identity-adapter, axi-notify relay), `zerolog`
  (api-gateway), and ad-hoc stderr JSON (axi-soul-api C++).
- Node.js services and frontends use `console.*` with no logger library.
- Android apps use `android.util.Log` only — no file persistence.
- `request_id` and `trace_id` columns exist in some database tables and Go
  middleware, but the stdlib logging Formatter never reads them.

Process-level evidence is also fragmented:

- PM2 captures 36 stdout/stderr files at `/Users/mose/.pm2/logs/` totaling
  ~1.3 GB without `merge_logs`/`max_size` policy.
- `products/ielts-vocab/logs/runtime/app-services-mac/` is written by a shell
  `nohup ... >> out 2>> err` redirection without rotation.
- `scripts/runtime/runtime-ledger.mjs` writes
  `/Users/mose/.local/share/axi-workspace/state/runtime-ledger/YYYY-MM-DD.jsonl`
  with no size-based rotation.

There is no Prometheus, no OpenTelemetry collector, no Loki, no Tempo, no
Grafana. The only workspace-wide alert channel is `devsvc-alert-watch.mjs` →
cc-connect Feishu. ADR-004 already accepts an adapter-layer model for agent
context packaging but does not cover runtime observability.

## Decision

Adopt a five-layer observability architecture implemented by the standalone
candidate project `candidates/observability`:

1. **SDK layer** — `axi_observability.logging` (Python), `axilog-go` (Go),
   `@axi/observability-logging` (Node), `axilog-android` (Kotlin),
   `axilog-web` (TypeScript browser). Each SDK owns structured JSON output,
   `trace_id`/`request_id` injection via contextvar / context.Context /
   AsyncLocalStorage, file rotation, and optional OTel exporter.
2. **Collection layer** — Loki (logs), Prometheus (metrics), OTel Collector
   (traces + metrics bridge), Promtail (log shipping from PM2 and
   runtime-ledger paths).
3. **Storage layer** — Loki (`/loki`), Prometheus TSDB (`/prometheus`), Tempo
   (`/tempo`). All run inside the candidate project's own `docker-compose.yml`
   and are managed by `dev-services` profile `observability` (default
   `profile_on_demand`).
4. **Visualization layer** — Grafana on port 13000 with five pre-built
   dashboards (`Axi / PM2 Services`, `Axi / Project Logs`, `Axi / Golden
   Signals`, `Axi / Trace Explorer`, `Axi / Health Check Trend`) and a
   `Datasource` provisioning file that points at the local Loki,
   Prometheus, and Tempo containers.
5. **Facade layer** — three entry points:
   - `devsvc logs <serviceId>` upgrades to default to Loki LogQL behind the
     scenes, with `--legacy` falling back to `pm2 logs`.
   - `devsvc-dashboard.mjs` adds an `/api/observability/*` namespace.
   - `axi-observability-mcp` (declared in
     `foundation/workspace-governance/mcp-servers.json`) exposes
     `axi_logs_query`, `axi_metrics_query`, `axi_traces_query`,
     `axi_health_snapshot` with the same response schema style as
     `mcp__mac-bridge__check_services`.

The candidate project reuses existing assets instead of duplicating them:

- `scripts/runtime/runtime-ledger.mjs` is the workspace-internal event bus;
  Loki and Promtail are downstream sinks, not a replacement.
- `devsvc-alert-watch.mjs` keeps its Feishu path; we add a parallel
  `devsvc-alert-notify-osx.mjs` for `osascript` desktop notifications.
- `axi-workbench-cli/checks/` gains a ninth `observability-instrumented`
  check that flags projects emitting bare `print(` or `console.log(`.
- `mcp__mac-bridge__check_services` is the response-schema template for
  the new MCP server; we do not modify it.
- The Python SDK follows the import-path style of `axi_kernel` and
  `axi_workbench` (sibling path insertion) — no separate PyPI publication
  is required in candidate status.

## Operating Rules

- The project must live at `/Volumes/code/workspace/candidates/observability`
  while in candidate status; promotion to `foundation/observability` follows
  the same maturity gate as `pelagic → foundation` migration.
- The five SDK packages each live under their own language directory
  (`python/`, `go/`, `node/`, `android/`, `web/`) inside the candidate root.
  Cross-language symbols (e.g. `traceparent` propagation) follow ADR-007
  naming.
- Each SDK is optional in downstream projects. Migration is progressive:
  `axi-workbench-cli`, `axi-workbench/services/api-gateway`, and
  `axi-workbench/services/control-plane` are the first demo adopters.
- `dev-services.config.json` adds an `observability` profile that depends on
  Docker; default `health_mode: profile_on_demand`. The `core` profile stays
  unchanged.
- The MCP server declaration lives in
  `foundation/workspace-governance/mcp-servers.json`, not in the candidate
  project's own manifest. This follows ADR-004 rule 5 (MCP declarations
  belong to consuming projects or workspace governance).
- Generated files (`docker-compose.override.yml`, Grafana provisioning cache,
  Loki chunks) must not be committed. A `.gitignore` lives at the candidate
  root.
- `candidates/observability/scripts/runtime-ledger-rotate.mjs` is shared
  with `scripts/runtime/` once stable; until then it lives only inside the
  candidate to avoid scope drift.
- No project in the workspace is required to migrate. AGENTS.md additions in
  migrated projects recommend the SDK but do not block non-migrated paths.
- The candidate never assumes access to a remote S3 / OSS / Loki Cloud;
  all backends run locally via Docker.

## Consequences

Positive:

- One canonical place for structured logging, metrics, and tracing — the
  five SDKs replace the current five-plus Python logging configurations,
  four Go logging styles, zero Node loggers, and the missing Android file
  persistence.
- Loki LogQL, PromQL, and TraceQL become the query surface; existing
  `runtime-ledger` JSONL keeps its `queryEvents` API as the offline
  fallback.
- DevSvc Dashboard gains a single observability tab; the mac-bridge MCP
  pattern is preserved.
- PM2 log rotation, i32 wall-bytes retention, and runtime-ledger size
  rotation are explicit code paths instead of implicit PM2 defaults.

Tradeoffs:

- A second Docker Compose stack (alongside sub2api's `docker-compose.dev.yml`)
  increases local resource usage; mitigated by `profile_on_demand` and
  bounded Loki retention (`compactor.retention_period=168h`).
- Five SDK packages means five versioning stories; we mitigate by pinning
  the contract (JSON schema, `traceparent` header) and version-bumping
  per-language only on breaking change.
- Trace correlation requires every service in a request path to read
  `traceparent`; until the SDK rollout completes, traces will be partial.
- The candidate project will appear in `WORKSPACE_INDEX.md` as
  `prototype / active-candidate` and may not advertise `1.0.0`.

## Verification

- `foundation/axi-skills/apm.yml` is **not** modified by this ADR (the APM
  adapter covers agent skills, not runtime telemetry).
- `python3 -m unittest discover -s python/axi_observability/tests` passes
  with coverage ≥ 80%.
- `go test ./go/axilog/...` passes with coverage ≥ 80%.
- `pnpm --dir node test` passes with coverage ≥ 80%.
- `cd candidates/observability && docker compose config -q` succeeds.
- `cd candidates/observability && docker compose up -d` brings up loki,
  prometheus, otel-collector, tempo, grafana without port conflicts
  (Grafana on 13000, Prometheus on 9090, Loki on 3100, OTel on 4317/4318,
  Tempo on 3200).
- `/Volumes/code/workspace/scripts/workspace-project validate` exits 0
  after the candidate is registered.
- `/Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs`
  reports 0 errors.
- The first batch of demo adopters
  (`axi-workbench-cli`, `axi-workbench/services/api-gateway`,
  `axi-workbench/services/control-plane`) replace their bare `print`,
  `zerolog`, and `console.*` paths with the SDK; their existing tests still
  pass.