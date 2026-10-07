---
id: axi-docs-zh-projects-observability
title: Axi Observability
type: project
status: published
tags: [Axi Docs, 项目, foundation, shared-observability]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Observability
graph-tags: [Projects, foundation, shared-observability]
description: AXI workspace unified observability stack: 5 language SDKs (Python, Go, Node, Web, Rust), Loki + Prometheus + OpenTelemetry + Tempo + Grafana backend, control plane (auth + event ledger + Loki/Tempo/Prometheus query facade + outbox replay + MCP ops server), React Query hooks for the devsvc-dashboard, and macOS Toast alerting.
project:
  id: observability
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-observability
  source-section: shared
---

# Axi Observability

> 项目根 `README.md` 和 `AGENTS.md` 镜像。事实源：
> [`/Volumes/code/workspace/foundation/axi-observability/README.md`](/Volumes/code/workspace/foundation/axi-observability/README.md)、
> [`/Volumes/code/workspace/foundation/axi-observability/AGENTS.md`](/Volumes/code/workspace/foundation/axi-observability/AGENTS.md)。
> Section: shared-observability / Partition: `foundation/`。

## Summary

`axi-observability` 是 AXI workspace 的统一 observability 基底。它用五种语言 SDK（Python `axi_observability`、Go `axilog-go`、Node `@axi/observability-logging`、Web `@axi/observability-web`、Rust `axi-observability-rs`）、五容器 backend（Loki + Promtail + Prometheus + OTel Collector + Tempo + Grafana）、Node 控制平面（带 token 守护的 event ledger 与 Loki/Tempo/Prometheus 查询 facade）、outbox-replay worker、`axi-observability-mcp` stdio MCP server、用于 devsvc-dashboard 的 React Query hooks、以及 macOS Toast alerting，替代了工作区原本碎片化的日志链路。`@axi/observability-events` 包把 `/internal/v1/observability/events` ingest endpoint 包装成规范化的 payload 合约、JSONL outbox 和可复用 adapter helpers（commit、sync、project.updated、warning、verification、service.health）。

**Stage**：shared foundation，project maturity `prototype`（按 `DESIGN.md` §6）；按 `docs/HANDOFF.md` 的 readiness 为 `control-plane-phase-1.6`（event ledger + auth + facade + outbox replay + project.update adapter + React hooks + macOS Toast + MCP ops）。
**Canonical path**：`/Volumes/code/workspace/foundation/axi-observability`。
**Working tree**：在 `dev` 上领先 `origin/dev` 3 commits（Rust SDK scaffold `9b06918` + ADR-019 `fad30ff`）。

分支策略：`main` 承载可发布构建；`dev` 承载日常集成。AGENTS.md 明确禁止在工作区根（ADR-003：workspace 根是非 git 容器）运行 `docker compose` 或任何 observability backend。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Python SDK | `axi_observability` (stdlib `logging` + `python-json-logger`); OpenTelemetry optional (`axi_observability[tracing]`); `prometheus-client` optional (`axi_observability[metrics]`) | Requires Python ≥ 3.11 |
| Go SDK | `axilog-go` (Go 1.25, `log/slog` + Gin middleware + OTel OTLP gRPC); module `github.com/axiomaticworld/observability/go/axilog` | Zerolog compatibility shim |
| Node SDK | `@axi/observability-logging` (pino 9, AsyncLocalStorage, W3C traceparent, optional `@opentelemetry/auto-instrumentations-node`); `@axi/observability-events` (control-plane adapter); `@axi/observability-web` (browser / Tauri webview → `/__observability/ingest`) | Requires Node ≥ 22 |
| Rust SDK | `axi-observability-rs` (Rust 2021, `tracing` + `tracing-subscriber` JSON, OTel 0.22, optional `prometheus` 0.13, optional `opentelemetry-otlp` gRPC); PyO3 bindings gated behind `pyo3` feature | `publish = false`; ADR-019 scaffold |
| React hooks | `@axi/observability-react-hooks` (React Query 5: `useObservabilityOverview` + 7 more queries + 2 mutations) | React 18/19 |
| Logging store | Loki 2.9.4 (`axi-observability-loki:2.9.4`, port 3100) | Local-config in container; ready check `/ready` |
| Metrics store | Prometheus v2.54.1 (port 9090, 512 MB budget) | TSDB volume `prometheus-data` |
| Tracing store | Tempo (port 3200, 256 MB); OTel Collector 0.110.0 (4317 gRPC + 4318 HTTP, health 13133) | `tempo.Dockerfile` |
| Collection | Promtail 2.9.4 with explicit volume mounts: `~/.pm2/logs`, `~/.local/share/axi-workspace/state`, `products/ielts-vocab/logs/runtime/app-services-mac`, `~/.axi/logs`, `tools/axi-video-downloader/logs` | Read-only mounts |
| Visualization | Grafana (port 13000, 256 MB, 5 prebuilt dashboards); DevSvc Dashboard `/api/observability/*` (4 endpoints) | Reuses `ok/port/url/status` schema |
| Control plane | Node 22 (`control-plane/src/server.mjs`); `AXI_OBSERVABILITY_GATEWAY_TOKEN` for Workbench Gateway via `X-Axi-Internal-Token` + `X-Axi-Subject`; scoped `X-Axi-Service-Token` for business services | Default listen `127.0.0.1:13100` |
| Outbox replay | `control-plane/src/outbox-replay.mjs` (Node 22) | Resumes JSONL outbox when the control plane is reachable again |
| Alerting | `scripts/devsvc-alert-notify-osx.mjs` (osascript Toast); existing `devsvc-alert-watch.mjs` keeps Feishu | macOS-native channel |
| MCP | `mcp/axi-observability-mcp` (Python ≥ 3.10; stdio; package name `axi_observability_mcp`) | Installed via `uvx axi-observability-mcp` |
| Event schema | `schemas/workspace-event.v2.schema.json` (WorkspaceEventV2) + `schemas/resource-policy.v1.json` | `eventType` pattern covers `commit.recorded`, `workspace.sync.*`, `project.*`, `verification.completed`, `service.*`, `trace.span.recorded`, `runtime.*`, `deployment.*`, `task.*`, `security.*`, `audit.*`, `ui.*` |
| Build / packaging | `pyproject.toml` (setuptools `find` in `python`); pnpm workspace `node/packages/*`; Go module `go/axilog`; Rust crate `rust/axi-observability-rs` | All internal-only, not published in candidate status |

## Project Layout

```text
axi-observability/
├── AGENTS.md / README.md / README.zh-CN.md    # scope, read order, boundaries, verification, relationship metadata
├── DESIGN.md                                   # ADR-010 local summary + Loki label contract + SDK one-liner recipes
├── PRD.md                                      # PRD-07 staged 0–5 delivery plan
├── TASK.md                                     # phase 0–6 definitions of done
├── CHANGELOG.md / CHANGE.md / TODO.md
├── pyproject.toml                              # Python SDK (axi_observability 0.0.1)
├── package.json                                # Node workspace root (@axi/observability-workspace 0.0.1)
├── go.mod                                      # top-level Go module pointer
├── pnpm-workspace.yaml
├── uv.lock                                     # canonical Python dependency lock
├── docker-compose.yml                          # 5-container backend (loki, promtail, prometheus, otel-collector, tempo)
├── tempo.Dockerfile
├── docker/
│   ├── loki.Dockerfile
│   ├── promtail.Dockerfile
│   ├── prometheus.Dockerfile
│   ├── otel.Dockerfile
│   └── grafana.Dockerfile
├── provisioning/
│   ├── loki/, promtail/, prometheus/, otel/, tempo/, grafana/   # backend configuration
├── python/
│   └── axi_observability/
│       ├── __init__.py                         # ObservabilityClient + ObservabilityContext facade
│       ├── client.py
│       ├── logging/                           # setup, formatter, handlers, redactor, safe_stringify, context
│       │   ├── setup.py                       # one-line setup(service=..., env=...)
│       │   ├── formatter.py                   # JsonFormatter
│       │   ├── handlers.py                    # ConsoleJsonHandler, RotatingJsonFileHandler
│       │   ├── context.py                     # AsyncLocalStorage-style scope binding
│       │   ├── redactor.py                    # privacy-preserving redactor (DEFAULT_SENSITIVE_FIELDS + AXI_AUDIT_ARGS=1)
│       │   └── safe_stringify.py              # circular-safe + type-error-safe JSON encoding
│       ├── tracing/
│       │   ├── __init__.py                    # setup_tracing, span, parse_traceparent, inject_traceparent
│       │   └── tracer.py
│       ├── metrics/                           # prometheus_client factories
│       └── tests/                             # test_{setup,formatter,context,redactor,safe_stringify,client,tracing,metrics}.py
├── go/
│   └── axilog/
│       ├── go.mod / go.sum                     # go 1.25.0, gin 1.10, otel 1.46
│       ├── logger.go                          # slog-backed axilog.New(axilog.WithService(...))
│       ├── middleware.go                      # GinMiddleware / GinMiddlewareWith + net/http helpers
│       ├── tracing.go                         # OTel setup + W3C propagation helpers
│       ├── context.go / internal.go / client.go
│       ├── redactor.go                        # sensitive-field redaction
│       ├── zerolog_compat.go                  # zerolog-style API compatibility shim
│       └── {logger,context,middleware,tracing,redactor,zerolog_compat,client,internal,example}_test.go
├── node/
│   └── packages/
│       ├── observability-logging/             # @axi/observability-logging 0.0.1 (pino)
│       │   └── src/{logger,context,formatter,redactor,safe-stringify,tracing,http,index}.ts
│       └── observability-events/              # @axi/observability-events 0.1.0
│           └── src/{index.mjs,index.d.mts}    # emitEvent + commitRecorded + workspaceSyncEvent + projectUpdatedEvent + warningEvent + verificationCompletedEvent + serviceHealthChangedEvent
├── web/
│   ├── package.json                           # @axi/observability-web 0.0.1
│   ├── src/{index.ts,console.ts}              # intercepts console.* + global errors, batches to /__observability/ingest
│   └── tests/
├── react-hooks/
│   ├── package.json                           # @axi/observability-react-hooks 0.1.0 (React Query 5)
│   └── src/{client,hooks,index,types}.ts      # useObservabilityOverview + 7 more queries + 2 mutations
├── rust/
│   └── axi-observability-rs/                  # Rust 2021; axi_observability_rs 0.2.0 (publish = false)
│       ├── Cargo.toml                         # tracing + opentelemetry + opentelemetry-otlp (optional) + prometheus + PyO3 (feature-gated)
│       └── src/{lib,logger}.rs
├── android/                                   # empty scaffold (no Kotlin SDK implementation yet)
├── control-plane/
│   └── src/
│       ├── server.mjs                         # token-gated event ledger + Loki/Tempo/Prometheus query facade (127.0.0.1:13100)
│       ├── outbox-replay.mjs                  # Outbox JSONL replay worker
│       ├── auth.mjs                           # X-Axi-Internal-Token + X-Axi-Subject / X-Axi-Service-Token
│       ├── event-store.mjs / store-registry.mjs / event-schema.mjs / migrate-v1-to-v2.mjs
│       ├── backend-facade.mjs / view-registry.mjs / resource-policy.mjs / redaction.mjs
├── schemas/
│   ├── workspace-event.v2.schema.json         # WorkspaceEventV2 (eventType regex, severity/status/classification enums)
│   └── resource-policy.v1.json
├── mcp/
│   └── axi-observability-mcp/
│       ├── README.md / pyproject.toml
│       └── axi_observability_mcp/server.py    # stdio MCP ops server
├── scripts/
│   ├── devsvc-alert-notify-osx.mjs            # osascript Toast channel
│   ├── runtime-ledger-rotate.mjs              # size-based rotate
│   └── ielts-logs-rotate.sh                   # nohup log rotation
└── docs/
    ├── HANDOFF.md
    ├── event-payload-contract.md              # project.updated etc. first-class payload contract
    ├── cookbook-outbox-replay.md              # outbox replay worker cookbook
    ├── cookbook-alert-osx.md                  # macOS Toast cookbook
    └── logs/submit/                           # auto-generated submit logs
```

## Build & Install

```bash
# Python SDK
pip install -e .                              # editable install from pyproject.toml
pip install -e .[tracing]                     # enable OpenTelemetry
pip install -e .[metrics]                    # enable prometheus_client

# Node SDK + events + react hooks + web
pnpm install
pnpm --filter @axi/observability-logging build
pnpm --filter @axi/observability-events build
pnpm --filter @axi/observability-react-hooks build
pnpm --filter @axi/observability-web build

# Go SDK
cd go/axilog && go mod tidy && go build ./...

# Rust SDK
cd rust/axi-observability-rs && cargo build [--features otlp] [--features pyo3]

# MCP server (Python ≥ 3.10)
uvx axi-observability-mcp
# or
python -m axi_observability_mcp.server

# Backend (docker compose, profile_on_demand)
cd /Volumes/code/workspace/foundation/axi-observability
docker compose config -q
docker compose up -d loki prometheus grafana

# Control plane
AXI_OBSERVABILITY_GATEWAY_TOKEN=local-gateway-token \
AXI_OBSERVABILITY_SERVICE_TOKENS='[{"token":"local-events-token","serviceId":"axi-workbench-control-plane","projectId":"axi-workbench","allowedActions":["events:write","telemetry:write"]}]' \
node control-plane/src/server.mjs

# Outbox replay
node control-plane/src/outbox-replay.mjs
```

## Verification

```bash
# Python SDK
PYTHONPATH=python python3 -m unittest discover -s python/axi_observability/tests -v

# Go SDK
cd go && go test ./...

# Node SDK
pnpm --dir node test
node --test node/packages/observability-events/tests/**/*.test.mjs
pnpm --filter @axi/observability-react-hooks test
node --test scripts/test/devsvc-alert-notify-osx.test.mjs

# MCP
.venv-mcp/bin/python -m unittest discover -s mcp/axi-observability-mcp/tests -v

# Control plane
node --test 'control-plane/test/**/*.test.mjs'

# Backend compose
docker compose config -q
docker compose up -d loki prometheus grafana

# Workspace-level
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs

# Bootstrap an SDK in any consumer
PYTHONPATH=cli python3 -c "from axi_observability.logging import setup; setup('axi-workbench-cli', 'dev')"
```

`axi-workbench-cli/checks/` 增加第 9 个 soft-check `observability-instrumented`，对裸 `print(` 和 `console.log(` 做 lint；不阻塞 CI。

## Architecture Highlights

系统按五层组织（DESIGN.md §1，ADR-010）。**SDK 层**提供五种语言面 —— Python（`axi_observability`，stdlib `logging` + JSON formatter + AsyncLocalStorage-style context binding + rotating file handlers + redactor）、Go（`axilog-go`，`log/slog` + Gin middleware + OTel OTLP gRPC + zerolog 兼容 shim）、Node（`@axi/observability-logging`，pino 9 + AsyncLocalStorage + W3C `traceparent` + `X-Request-ID`）、Web（`@axi/observability-web`，拦截 `console.*` 和全局错误，批量上报 `/__observability/ingest`）、Rust（`axi-observability-rs`，tracing + tracing-subscriber JSON + OTel + 可选 prometheus + 可选 PyO3 bindings）。`@axi/observability-events` 把 control-plane ingest endpoint 包装成规范化的 payload helpers（`commitRecorded`、`workspaceSyncEvent`、`projectUpdatedEvent`、`warningEvent`、`verificationCompletedEvent`、`serviceHealthChangedEvent`）；Android Kotlin SDK **尚未**实现（README 显式声明）。

**Collection 层** 使用 Promtail，配合显式只读 volume mounts（`~/.pm2/logs`、`~/.local/share/axi-workspace/state`、`products/ielts-vocab/logs/runtime/app-services-mac`、`~/.axi/logs`、`tools/axi-video-downloader/logs`）。每个 service 自带 `/metrics` endpoint；OTel auto-instrumentation 通过 `@axi/observability-logging` 的可选 peer dependencies（`@opentelemetry/auto-instrumentations-node`、`@opentelemetry/sdk-node`）接入。

**Storage 层** 是五容器 docker compose：Loki 2.9.4（3100，512 MB）承载 logs，Prometheus v2.54.1（9090，512 MB）承载 metrics，OTel Collector 0.110.0（4317 gRPC + 4318 HTTP + 13133 health）承载 trace receivers + exporters，Otel + Tempo（3200，256 MB）承载 trace 存储。Total memory budget ≈ 1.8 GB。Grafana（13000，256 MB）交付 5 个预置 dashboard；DevSvc Dashboard 新增 Observability tab，提供 4 个 `/api/observability/*` endpoints。

**Control plane**（`control-plane/src/server.mjs`）是 events 的权威 ingest + facade。Workbench Gateway 用 `X-Axi-Internal-Token` + `X-Axi-Subject` 认证；business services 使用按 `AXI_OBSERVABILITY_SERVICE_TOKENS` 配发的 scoped `X-Axi-Service-Token`。schema 是 `schemas/workspace-event.v2.schema.json`（WorkspaceEventV2，`eventType` regex 覆盖 `commit.recorded`、`workspace.sync.*`、`project.{created,updated,archived,warning.*}`、`verification.completed`、`service.{started,stopped,health.changed,endpoint.unreachable}`、`trace.span.recorded`、`runtime.{started,stopped}`、`deployment.{started,completed,failed}`、`task.{started,completed,failed}`、`security.{authentication.failed,authorization.denied}`、`audit.{resource.{read,exported},sensitive.field.viewed,policy.changed}`、`ui.{contract.gap,icon.{invalid,duplicate},loading.violation,style.violation,page.exception}`）。v1→v2 migration 由 `migrate-v1-to-v2.mjs` 提供。Browser / Tauri webview SDK **永不** 直连 Loki/Tempo/Prometheus —— 它们走 control-plane facade。**Facade 层** 在已有 `runtime-ledger.mjs` event bus 之上添加三个增量：`devsvc logs <serviceId>`（默认读 Loki；`--legacy pm2` 回退）、`devsvc-alert-notify-osx`（`scripts/devsvc-alert-notify-osx.mjs` osascript Toast —— 补足现有 `devsvc-alert-watch.mjs` Feishu channel）、以及 `axi-observability-mcp`（stdio MCP ops server，通过 `uvx axi-observability-mcp` 安装，复用 `mcp__mac-bridge__check_services` 的 `ok/port/url/status` schema）。React Query 5 hooks 在 `@axi/observability-react-hooks`（`useObservabilityOverview` + 7 more queries + 2 mutations），目标为 devsvc-dashboard + Workbench admin UI。

**Loki label contract** 固定为 `{service, env, level, project}`。`service` 来自 devsvc `serviceId`；`env` 来自 `AXI_ENV`（dev / staging / prod）；`level` 是 `debug / info / warn / error`；`project` 是 workspace graph node id（如 `axi-workbench`）。payload（`ts` ISO 8601 UTC、`logger`、`service`、`env`、`trace_id`、`request_id`、`caller`、`message`、`extra`）**不**被索引。trace context 使用 W3C `traceparent` + 自定义 `X-Request-Id` 双重追踪；`AXI_AUDIT_ARGS=1` 选择性输出 args / sensitive fields（redactor 默认忽略；`DEFAULT_SENSITIVE_FIELDS` 覆盖 `password`、`passwd`、`secret`、`token`、`api_key`、`apikey`、`authorization`、`auth`、`credential`、`credentials`、`private_key`）。

**Outbox-replay worker**（`control-plane/src/outbox-replay.mjs`）在 control plane 重新可达时重放 JSONL outbox 记录。**Rust SDK scaffold**（ADR-019）为 `axi-observability-rs@0.2.0`，提供 `tracing` + `tracing-subscriber` JSON + OpenTelemetry 0.22 + 可选 `opentelemetry-otlp` gRPC（feature `otlp`）、`prometheus` 0.13，以及面向 Python consumer 的 PyO3 bindings（feature `pyo3`）。`publish = false`，待特性评审后再开启。

## Key Modules/Files

| Path | Role |
| --- | --- |
| `python/axi_observability/__init__.py` | Public facade: `ObservabilityClient`, `ObservabilityContext` |
| `python/axi_observability/logging/setup.py` | One-line `setup(service=..., env=..., level=...)` (re-entrant) |
| `python/axi_observability/logging/formatter.py` | `JsonFormatter` — stable Loki-friendly JSON shape |
| `python/axi_observability/logging/handlers.py` | `ConsoleJsonHandler`, `RotatingJsonFileHandler` (size-based rotate) |
| `python/axi_observability/logging/context.py` | AsyncLocalStorage-style scope binding for `trace_id` / `request_id` |
| `python/axi_observability/logging/redactor.py` | Privacy redactor (`DEFAULT_SENSITIVE_FIELDS` + `AXI_AUDIT_ARGS=1` opt-in) |
| `python/axi_observability/logging/safe_stringify.py` | Circular-safe + TypeError-safe encoding |
| `python/axi_observability/tracing/__init__.py` | `setup_tracing`, `span`, `parse_traceparent`, `inject_traceparent` |
| `python/axi_observability/metrics/__init__.py` | `prometheus_client` Counter / Gauge / Histogram factories |
| `python/axi_observability/client.py` + `context.py` | Top-level client + per-log context |
| `python/axi_observability/tests/` | `test_{setup,formatter,context,redactor,safe_stringify,client,tracing,metrics}.py` |
| `go/axilog/logger.go` | `axilog.New(Options{Service, Writer, Level})` + `WithService` |
| `go/axilog/middleware.go` | `GinMiddleware` / `GinMiddlewareWith` + `net/http` helpers (`HeaderRequestID`, `HeaderTraceParent`) |
| `go/axilog/tracing.go` | OTel setup + W3C propagation + per-request span helper |
| `go/axilog/context.go` / `internal.go` / `client.go` | Trace / request-id binding; internal client helpers |
| `go/axilog/redactor.go` | Sensitive-field redaction |
| `go/axilog/zerolog_compat.go` | zerolog-style API compatibility shim |
| `node/packages/observability-logging/src/logger.ts` | `createLogger`, `shutdownAll`, `resolveLevel` |
| `node/packages/observability-logging/src/context.ts` | AsyncLocalStorage binding: `currentTraceId`, `currentRequestId`, `currentUserId`, `currentExtra` |
| `node/packages/observability-logging/src/redactor.ts` | `redact`, `isFieldSensitive`, `DEFAULT_SENSITIVE_FIELDS`, `REDACTED_SENTINEL` |
| `node/packages/observability-logging/src/safe-stringify.ts` | `safeStringify` (`CIRCULAR_MARKER`, `TYPE_ERROR_MARKER`) |
| `node/packages/observability-logging/src/tracing.ts` | `parseTraceparent` / `injectTraceparent` / `startNodeAutoInstrumentation` |
| `node/packages/observability-logging/src/http.ts` | `HEADER_REQUEST_ID`, `HEADER_TRACE_PARENT`, `generateRequestId`, `generateTraceId`, framework-agnostic middleware |
| `node/packages/observability-events/src/index.mjs` | `emitEvent`, `commitRecorded`, `workspaceSyncEvent`, `projectUpdatedEvent`, `warningEvent`, `verificationCompletedEvent`, `serviceHealthChangedEvent` |
| `web/src/index.ts` + `console.ts` | `axilogWeb.install(service, ingestUrl)`; intercepts `console.*` + global errors |
| `react-hooks/src/hooks.ts` | `useObservabilityOverview` + 7 more queries + 2 mutations (React Query 5) |
| `react-hooks/src/client.ts` | Typed HTTP client for `/api/v1/observability/*` |
| `rust/axi-observability-rs/Cargo.toml` + `src/{lib,logger}.rs` | Rust SDK scaffold (`tracing` + OTel + optional `prometheus` + optional `pyo3`) |
| `docker-compose.yml` | Five-container backend (loki, promtail, prometheus, otel-collector, tempo) + Grafana |
| `docker/loki.Dockerfile`, `promtail.Dockerfile`, `prometheus.Dockerfile`, `otel.Dockerfile`, `grafana.Dockerfile` + `tempo.Dockerfile` | Per-service images with baked-in local configs |
| `provisioning/{loki,promtail,prometheus,otel,tempo,grafana}/` | Backend configuration |
| `control-plane/src/server.mjs` | Auth + event ledger + Loki/Tempo/Prometheus query facade (127.0.0.1:13100) |
| `control-plane/src/outbox-replay.mjs` | JSONL outbox replay worker |
| `control-plane/src/auth.mjs` | `X-Axi-Internal-Token` + `X-Axi-Subject` / `X-Axi-Service-Token` enforcement |
| `control-plane/src/event-schema.mjs` / `migrate-v1-to-v2.mjs` | WorkspaceEventV2 schema + v1→v2 migration |
| `control-plane/src/event-store.mjs` / `store-registry.mjs` | Event ledger + multi-store registry |
| `control-plane/src/backend-facade.mjs` / `view-registry.mjs` | Loki/Tempo/Prometheus query facade + view registry |
| `control-plane/src/resource-policy.mjs` / `redaction.mjs` | Resource policy + redaction at the facade boundary |
| `schemas/workspace-event.v2.schema.json` | WorkspaceEventV2 contract (`eventType` regex, severity / status / classification enums, `provenance.required: [source]`) |
| `schemas/resource-policy.v1.json` | Resource access policy |
| `mcp/axi-observability-mcp/axi_observability_mcp/server.py` | stdio MCP ops server (`uvx axi-observability-mcp`) |
| `scripts/devsvc-alert-notify-osx.mjs` | macOS Toast alert channel (osascript) |
| `scripts/runtime-ledger-rotate.mjs` | Size-based rotate for runtime-ledger JSONL |
| `scripts/ielts-logs-rotate.sh` | nohup log rotation helper |
| `docs/event-payload-contract.md` | `project.updated` etc. first-class payload contract |
| `docs/cookbook-outbox-replay.md` / `docs/cookbook-alert-osx.md` | Ops integration cookbooks |
| `docs/HANDOFF.md` | Zero-context handoff; readiness `control-plane-phase-1.6` |
| `DESIGN.md` | ADR-010 local summary + Loki label contract + one-line SDK recipes |
| `TASK.md` | Phase 0–6 definitions of done (PRD admission → Rust scaffold) |
| `PRD.md` | PRD-07 staged delivery plan |
| `AGENTS.md` | Scope, read order, boundaries, request defaults, verification, relationship metadata |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Phase 0 — PRD admission | `route-intent` candidate, ADR-010 drafted, three-piece check green, first commit on `dev` | Complete |
| Phase 1 — SDK core (5 packages) | Python logging/tracing/metrics; Go `axilog`; Node `@axi/observability-logging` | Complete; Android/Kotlin explicitly not implemented |
| Phase 1.5 — React hooks v2 wiring + docker / provisioning refresh | React Query 5 hooks live; backend provisioning refreshed | Complete (`ddf3417`) |
| Phase 1.6 — control-plane expansion | event schema v1→v2 migration, outbox replay, project.update adapter, react hooks, OSX Toast, MCP server | Complete (`08fc54d`, `cbeba2a`); readiness `control-plane-phase-1.6` |
| ADR-019 — Rust SDK scaffold | Rust 2021 SDK with `tracing` + OTel + optional `prometheus` + optional PyO3 bindings | In flight (`fad30ff` ADR, `9b06918` scaffold); `publish = false` |
| Go trace context fix | Export `TraceIDContextKey` + tidy `go.mod` | Complete (`6c0ad48`) |
| Lint compliance | `axi-workbench-cli/checks/` `observability-instrumented` soft-check | Live (does not block CI) |
| Maturity promotion (prototype → mvp → product-candidate) | 3 SDKs ≥ 80% coverage; docker compose 5 containers with < 1 port conflict; ≥ 3 demo projects; DevSvc Dashboard tab 4/4 200s; macOS Toast screenshot | Pending (per `DESIGN.md` §6) |
| Linux/Android Kotlin SDK | Tauri webview ingest path | Android explicitly not implemented; no Kotlin SDK shipped yet |

详见 `TASK.md`（staged definition-of-done）、`TODO.md`（stable-ID maintenance queue；`TODO-T-001` Axi-agent / Axi-runtime trace protocol 与 `TODO-T-002` Kotlin SDK claim removal 均 2026-09-27 完成）和 `CHANGELOG.md`（per-implementation-change history）。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-observability/AGENTS.md) — scope, read order, boundaries, request defaults, verification, relationship metadata
- [`README.md`](/Volumes/code/workspace/foundation/axi-observability/README.md) — mission, quick start, module overview, ADR-010 architecture layers
- [`README.zh-CN.md`](/Volumes/code/workspace/foundation/axi-observability/README.zh-CN.md) — Simplified Chinese mirror
- [`DESIGN.md`](/Volumes/code/workspace/foundation/axi-observability/DESIGN.md) — ADR-010 local summary, Loki label contract, SDK one-liners, port / memory budget, maturity promotion path
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-observability/PRD.md) — PRD-07 staged delivery plan
- [`TASK.md`](/Volumes/code/workspace/foundation/axi-observability/TASK.md) — Phase 0–6 definitions of done
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-observability/TODO.md) — stable-ID maintenance queue
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-observability/CHANGELOG.md) — per-implementation-change history
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-observability/CHANGE.md) — behavior / workflow / validation change log pointer
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-observability/docs/HANDOFF.md) — zero-context handoff; readiness `control-plane-phase-1.6`
- [`docs/event-payload-contract.md`](/Volumes/code/workspace/foundation/axi-observability/docs/event-payload-contract.md) — `project.updated` etc. first-class payload contract
- [`docs/cookbook-outbox-replay.md`](/Volumes/code/workspace/foundation/axi-observability/docs/cookbook-outbox-replay.md) — outbox replay worker cookbook
- [`docs/cookbook-alert-osx.md`](/Volumes/code/workspace/foundation/axi-observability/docs/cookbook-alert-osx.md) — macOS Toast cookbook
- [`schemas/workspace-event.v2.schema.json`](/Volumes/code/workspace/foundation/axi-observability/schemas/workspace-event.v2.schema.json) — WorkspaceEventV2 contract
- [`schemas/resource-policy.v1.json`](/Volumes/code/workspace/foundation/axi-observability/schemas/resource-policy.v1.json) — Resource access policy
- [`docker-compose.yml`](/Volumes/code/workspace/foundation/axi-observability/docker-compose.yml) — five-container backend
- [`python/axi_observability/__init__.py`](/Volumes/code/workspace/foundation/axi-observability/python/axi_observability/__init__.py) — Python SDK entry
- [`go/axilog/logger.go`](/Volumes/code/workspace/foundation/axi-observability/go/axilog/logger.go) — Go SDK entry
- [`node/packages/observability-logging/src/index.ts`](/Volumes/code/workspace/foundation/axi-observability/node/packages/observability-logging/src/index.ts) — Node SDK entry
- [`node/packages/observability-events/src/index.mjs`](/Volumes/code/workspace/foundation/axi-observability/node/packages/observability-events/src/index.mjs) — control-plane event adapter entry
- [`web/src/index.ts`](/Volumes/code/workspace/foundation/axi-observability/web/src/index.ts) — browser / Tauri webview entry
- [`react-hooks/src/hooks.ts`](/Volumes/code/workspace/foundation/axi-observability/react-hooks/src/hooks.ts) — React Query 5 hooks
- [`rust/axi-observability-rs/Cargo.toml`](/Volumes/code/workspace/foundation/axi-observability/rust/axi-observability-rs/Cargo.toml) — Rust SDK scaffold (ADR-019)
- [`control-plane/src/server.mjs`](/Volumes/code/workspace/foundation/axi-observability/control-plane/src/server.mjs) — control-plane entry
- [`control-plane/src/outbox-replay.mjs`](/Volumes/code/workspace/foundation/axi-observability/control-plane/src/outbox-replay.mjs) — outbox replay worker
- [`mcp/axi-observability-mcp/axi_observability_mcp/server.py`](/Volumes/code/workspace/foundation/axi-observability/mcp/axi-observability-mcp/axi_observability_mcp/server.py) — stdio MCP ops server
- [`scripts/devsvc-alert-notify-osx.mjs`](/Volumes/code/workspace/foundation/axi-observability/scripts/devsvc-alert-notify-osx.mjs) — macOS Toast channel
- ADR-010: `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-010-axi-observability-architecture.md`
- ADR-019: `docs/adr/ADR-019-rust-sdk-plan` (Rust SDK scaffold plan)

## Cross-References

- Workspace root: `/Volumes/code/workspace/AGENTS.md`, `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance`
- Workspace registry / project graph: `/Volumes/code/workspace/workspace.graph.json`, `scripts/workspace-project list`
- Relationship metadata as a Provider — capabilities `observability-python-sdk` (runtime), `observability-go-sdk` (runtime), `observability-node-sdk` (runtime), `observability-web-sdk` (runtime), `observability-rust-sdk` (runtime), `observability-control-plane` (runtime), `observability-mcp` (runtime), `observability-react-hooks` (runtime), `observability-event-schema` (runtime); requiredness `required`
- ADR references: ADR-003 (workspace-root-is-non-git-container), ADR-004 (apm-agent-context-package-layer), ADR-010 (axi-observability-architecture), ADR-019 (rust SDK plan, in flight)
- Consumers listed in `AGENTS.md`: `foundation/axi-workbench-cli` + `workbench/axi-workbench/services/api-gateway` + `workbench/axi-workbench/services/control-plane` (first demo batch)
- Existing infrastructure: `scripts/runtime/runtime-ledger.mjs` (workspace event bus; Promtail is its downstream sink, not a replacement), `devsvc-alert-watch.mjs` (Feishu channel preserved), `mcp__mac-bridge__check_services` (schema blue print for the new MCP server), `axi-workbench-cli/checks/` (`observability-instrumented` as 9th soft check)
- Backed services (profile_on_demand): Grafana `http://127.0.0.1:13000`, Prometheus `http://127.0.0.1:9090`, Loki `http://127.0.0.1:3100`, OTel Collector `127.0.0.1:4317/4318`, Tempo `http://127.0.0.1:3200`, Control plane `http://127.0.0.1:13100`
- Recent trajectory: `9b06918` Rust SDK scaffold; `fad30ff` ADR-019 plan; `6c0ad48` Go `TraceIDContextKey` export + tidy; `ddf3417` react-hooks v2 wiring + docker / provisioning refresh; `95507b8` Node + Go + Python SDK updates + uv.lock pin; `cbeba2a` event schema v1→v2 + control-plane expansion; `41ffa46` top-level documentation refresh + `.gitignore` hygiene; `dde910a` phase 1.6 follow-up; `08fc54d` phase 1.6 — outbox replay + project.update adapter + react hooks + OSX Toast + MCP server

## 说明

`axi-observability` 是 AXI workspace 的统一 observability 基底，路径 `/Volumes/code/workspace/foundation/axi-observability`。它提供 5 种语言 SDK（Python `axi_observability`、Go `axilog-go`、Node `@axi/observability-logging`、Web `@axi/observability-web`、Rust `axi-observability-rs`），加 5 容器 backend（Loki 2.9.4 + Promtail + Prometheus v2.54.1 + OTel Collector 0.110.0 + Tempo，加 Grafana；总计 ~1.8 GB memory budget）。**Control plane**（`control-plane/src/server.mjs`，默认监听 `127.0.0.1:13100`）是 events 的权威 ingest + facade：`X-Axi-Internal-Token` + `X-Axi-Subject` 用于 Workbench Gateway，`X-Axi-Service-Token`（按 `AXI_OBSERVABILITY_SERVICE_TOKENS` 配发）用于 business services。Schema 为 `schemas/workspace-event.v2.schema.json`（WorkspaceEventV2，`eventType` regex 覆盖 `commit.recorded` / `workspace.sync.*` / `project.*` / `verification.completed` / `service.*` / `trace.span.recorded` / `runtime.*` / `deployment.*` / `task.*` / `security.*` / `audit.*` / `ui.*`），由 `migrate-v1-to-v2.mjs` 提供 v1→v2 迁移。**Loki label contract** 固定为 `{service, env, level, project}`（payload 不索引；trace 用 W3C `traceparent` + `X-Request-Id` 双重追踪；`DEFAULT_SENSITIVE_FIELDS` 覆盖 password / secret / api_key / private_key 等，`AXI_AUDIT_ARGS=1` 选择性输出 args）。Facade 在 `runtime-ledger.mjs` 之上加 `devsvc logs`（默认读 Loki；`--legacy pm2` 回退）、`devsvc-alert-notify-osx.mjs`（osascript Toast）+ `axi-observability-mcp`（stdio MCP，复用 `mcp__mac-bridge__check_services` `ok/port/url/status` schema）。React Query 5 hooks 在 `@axi/observability-react-hooks`。ADR-019 Rust SDK scaffold（`axi-observability-rs@0.2.0`）使用 `tracing` + OTel 0.22 + 可选 `opentelemetry-otlp` gRPC（feature `otlp`）+ `prometheus` 0.13 + 可选 `pyo3` bindings；`publish = false`。AGENTS.md 明确禁止在工作区根运行 `docker compose`（ADR-003）。`axi-workbench-cli/checks/` 第 9 个 soft-check `observability-instrumented` 检测裸 `print(` / `console.log(`。