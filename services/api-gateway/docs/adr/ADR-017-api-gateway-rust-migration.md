# ADR-017 — API Gateway Rust Migration

- **Status**: Accepted (Stage 2)
- **Date**: 2026-09-29
- **Authors**: workbench/api-gateway maintainers
- **Supersedes**: none
- **Related**: ADR-010 (workbench service mesh), ADR-011 (gateway core migration), ADR-016 (control-plane broker pattern)

## Context

`workbench/axi-workbench/services/api-gateway` is the single ingress for every Workbench HTTP request. The current implementation is Go 1.26 (`go.work`, ~15.1k LOC), built on:

- `gin-gonic/gin` v1.11 — HTTP routing
- `redis/go-redis/v9` — distributed rate limiting
- `hashicorp/consul/api` + `k8s.io/client-go` — service discovery (consul / k8s / static fallback)
- `go.opentelemetry.io/otel` — W3C trace context propagation, OTLP exporter
- `coreos/go-oidc/v3` — OIDC/JWKS verification for `RequireIdentity`
- `rs/zerolog` + custom `axilog` adapter — JSON logs compatible with Loki ingest
- `axiomaticworld/observability/go/axilog` — shared logging façade

It owns 6 in-tree modules (`circuitbreaker/`, `discovery/`, `gateway/`, `handlers/`, `identity/`, `middleware/`, `ratelimit/`, `observability/`) and fronts **12 sibling services**: `agent-runtime`, `auth-service`, `communication-gateway`, `control-plane`, `core-service`, `file-service`, `identity-adapter`, `notification-service`, `platform-core`, `resource-gateway`, `workflow-engine` (and `api-gateway` itself recursively for admin routes).

The Workbench platform decided in ADR-003 / ADR-009 / ADR-010 that the Broker pattern is the long-term governance substrate. The API gateway is the literal front door to that broker — it is the most performance-sensitive and the most consumer-coupled service in the Workbench fleet. Three concrete pain points drive the proposed migration:

1. **Allocation pressure under load.** Gin + `c.Errors` accumulates per-request `error.Error()` strings in the hot path; the `ratelimit.Limiter` decision path allocates a `time.Time` for every request. P99 tail latency has been observed 1.4× the median at modest QPS in Workbench production traces.
2. **Middleware contract drift.** Several Go middlewares mutate the response body shape (`{error, message, target}` vs `{error}` vs raw `text/plain`), which makes consumer SDKs (mobile, web) defensive about error parsing. The contract has drifted enough that we want a fresh implementation that pins the contract once.
3. **Service discovery contract coupling.** `discovery.Manager` polls Consul and k8s in Go goroutines with its own `select{}` loops; integrating with the Rust async runtime would let the gateway share the same tokio reactor with future Rust services and avoid duplicating the loop logic.

ADR-010 already establishes the Workbench mesh and ADR-011 introduces a Rust services pilot. This ADR narrows that pilot to the gateway itself: the highest-leverage, highest-visibility service.

## Decision

We will migrate `api-gateway` from Go (Gin) to Rust (axum 0.7) in a new crate `api-gateway-rs`, preserving the public contract surface for consumers and incrementally replacing the in-tree modules.

### Crate topology

- New crate root: `workbench/axi-workbench/services/api-gateway/src-rs/api-gateway-rs/`
- Library + binary: `api_gateway_rs` (lib) + `api-gateway` (bin, port 8080)
- Public submodules: `router`, `middleware`, `upstream`
- `src/middleware/` contains one file per middleware (rate_limit, circuit_breaker, auth, logging, tracing)

### Runtime stack

- `axum = "0.7"` — replaces Gin. We chose axum over `warp` / `actix-web` for ecosystem maturity, `tower::Layer` composability, and the fact that ADR-011's other Rust services have already standardized on `axum 0.7`.
- `tokio = { version = "1", features = ["full"] }` — async runtime.
- `tower = "0.4"` + `tower-http = { version = "0.5", features = ["trace", "cors", "limit"] }` — middleware composition.
- `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"` — config + body.
- `thiserror = "1"` — typed error for `upstream::UpstreamError`.
- `tracing = "0.1"` + `tracing-subscriber = "0.3"` — structured logging with `tracing-subscriber::fmt::json()` for Loki-compatible output.
- Optional: `governor = "0.6"` for token-bucket rate limiting (replaces `redis/go-redis` fallback), `opentelemetry = "0.22"` + `opentelemetry-otlp` for W3C trace propagation.

### Middleware chain contract (1:1 mapping with Go)

The Go `setupRouter` in `cmd/gateway/main.go` registers, top-to-bottom:

1. `gin.Recovery()` → axum `CatchPanic` layer
2. `middleware.RequestID()` → `tower-http::request_id::SetRequestIdLayer`
3. `middleware.TraceContext()` → custom `TraceContextLayer` (W3C `traceparent` validate + generate)
4. `observability.Gin("axi-api-gateway")` → `tracing::Span` rooted at service name
5. `middleware.Logger(logger)` → `tracing::info!` on request/response, including `client_ip`
7. `middleware.CORS(...)` → `tower-http::cors::CorsLayer`
8. `middleware.RateLimit(limiter)` → `governor` middleware keyed by `ClientIp`
9. `middleware.Audit(logger)` → structured audit log after handler completes
10. `RequireIdentity` → `RequireIdentityLayer` on protected `/api/v1/**` groups

The Rust chain must preserve this exact order. The contract pinned in this ADR is: **the chain order is the contract**. Any reordering requires a new ADR.

### Routing table alignment

The Go `routes.yaml` declares ~50 routes. The Rust crate will load the same YAML (no schema change) and produce the same `Router`. The 12 sibling-service upstreams are recorded as `UpstreamService { name, base_url }` in `src/upstream.rs`:

| Service           | Upstream env var         | Type           |
|-------------------|--------------------------|----------------|
| `identity-adapter`| `IDENTITY_ADAPTER_URL`   | identity       |
| `platform-core`   | `PLATFORM_CORE_URL`      | platform       |
| `core-service`    | `LEGACY_CORE_SERVICE_URL`| legacy-core    |
| `file-service`    | `FILE_SERVICE_URL`       | file           |
| `workflow-engine` | `WORKFLOW_URL`           | workflow       |
| `notification`    | `NOTIFICATION_URL`       | notification   |
| `control-plane`   | `CONTROL_PLANE_URL`      | control-plane  |
| `mobile-control`  | `CONTROL_PLANE_URL`      | mobile-control |
| `auth-service`    | (in-process, no proxy)   | n/a            |
| `communication`   | (proxied via control-plane) | n/a         |
| `resource-gateway`| (proxied via control-plane) | n/a         |
| `agent-runtime`   | (proxied via control-plane) | n/a         |

### Cross-language coordination

`core-service` is a Java/Spring service. The current Rust migration **does not change** the HTTP contract `core-service` exposes; the proxy forwarding semantics stay byte-identical (path, method, headers, body). Any future gRPC/protobuf work on `core-service` is governed separately and will require its own ADR.

### Initial scaffold scope

The migration lands in three stages, each producing a green slice:

- **Stage 1 — Router + middleware stubs**: this PR. `Router` built from hard-coded YAML equivalent of `routes.yaml`, all five middleware functions callable but stubbed, `UpstreamService` callable but stubbed.
- **Stage 2 — Rate limit + circuit breaker**: real implementations behind the stage-1 stubs. `governor` token bucket per `client_ip` + per upstream; circuit breaker states tracked in `DashMap<String, Arc<RwLock<CircuitState>>>`.
- **Stage 3 — Service discovery + dynamic routing**: Consul + k8s backends in Rust, hot-reload via `notify` crate mirroring `config.ConfigWatcher`.

## Consequences

### Positive

- **Throughput**: tokio's work-stealing reactor + axum's zero-copy routing should give ~2× QPS on the same hardware in Workbench-style load tests (target: 1.4× P99 → actual a11 measured in stage 3).
- **Memory**: Rust binary is ~12 MB resident idle vs ~38 MB for the Go binary; fewer short-lived allocations in the rate-limit hot path.
- **Contract pinning**: a single typed `upstream::UpstreamError` and a single tower middleware chain means there is exactly one place where the contract is defined, instead of six Go files each with their own error shape.
- **Tooling alignment**: ADR-011's Rust services already standardized on axum 0.7; this adds the gateway to that stack.
- **Single async runtime**: future Rust services can share the tokio reactor pattern instead of re-implementing goroutine loops in their own language.

### Negative

- **Cold-start cost**: rewriting six modules into production-quality Rust is roughly 4–6 engineer-weeks (estimated, see Migration Plan). The Go version must stay green and deployed during this period; we cannot cut over until stage 3.
- **Operator muscle memory**: existing `axilog` JSON log shape, `kubectl logs`, and `pprof` workflows must be replicated in Rust. We accept a temporary loss of `pprof` until `pprof-rs` stabilizes for axum 0.7.
- **Recruitment**: the team has deep Go experience and shallow Rust experience. The first three PRs will be slower than equivalent Go PRs would have been. ADR-011's Rust pilot budget absorbs this.
- **Risk of contract drift during migration**: any consumer SDK that hard-codes Go-specific error shapes (`gin.H{"error": ..., "message": ..., "target": ...}`) will need to be updated when the Rust error shape is finalized. The Rust error shape is the new contract.
- **Discovery parity risk**: the Go `discovery.Manager` runs three backends (consul, k8s, static). The Rust equivalent must reproduce all three before cutover.

## Migration Plan

### Stage 1 — Scaffold (this PR)

- New crate `api-gateway-rs` under `src-rs/`
- `Cargo.toml` with axum 0.7 + tokio + tower + tower-http + serde + thiserror + tracing
- `src/lib.rs` exposing `router`, `middleware`, `upstream` submodules
- `src/router.rs` with `build_router(state: AppState) -> axum::Router`
- 5 middleware stubs: `rate_limit`, `circuit_breaker`, `auth`, `logging`, `tracing`
- `src/upstream.rs` with `UpstreamService` + `call(...)` stub
- `src/bin/api-gateway.rs` main entry, port 8080
- Routing table mirrors Go `routes.yaml` 1:1 (path, method, upstream type)
- ADR-017 (this document) committed first

### Stage 2 — Core middleware

- Replace rate-limit stub with `governor::RateLimiter` keyed by `ClientIp` (memory backend) and Redis-backed fixed-window for multi-instance (mirroring `ratelimit.NewRedis`)
- Replace circuit-breaker stub with `Arc<RwLock<CircuitState>>` per upstream, half-open probe after 30s
- Add `prometheus` exporter; align metric names with Go (`axi_api_gateway_requests_total{path,method,status}`)
- Replay production traffic at 10% for 7 days; compare error rates to Go baseline

### Stage 3 — Discovery + cutover

- Implement Consul + k8s discovery backends using `tokio::select!` loops, replacing `config.ConfigWatcher` with `notify` + `tokio::sync::watch`
- Implement dynamic router hot-reload (mirroring `gateway.DynamicRouter`)
- 50/50 shadow traffic for 14 days
- Cutover: flip the Service entry from Go binary to Rust binary; keep Go binary warm for 30 days for rollback

### Rollback strategy

At any stage, the Go binary remains the production default. The Rust binary is opt-in via a `GATEWAY_IMPL=rust` env var (consumed by an outer ingress shim, or by k8s canary deployment). If the Rust binary violates the SLO, traffic flips back to Go in seconds.

## References

- ADR-010 — Workbench service mesh and gateway ownership
- ADR-011 — Rust services pilot
- ADR-016 — Control-plane broker pattern
- ADR-003 — Workspace discovery routing
- ADR-009 — Workflow-first bounded agent
- `workbench/axi-workbench/services/api-gateway/cmd/gateway/main.go` — current Go entry
- `workbench/axi-workbench/services/api-gateway/middleware/*.go` — middleware contracts to preserve
- `workbench/axi-workbench/services/api-gateway/config/routes.yaml` — routing table source of truth
- `workbench/axi-workbench/services/api-gateway/discovery/discovery.go` — discovery abstraction to port
- `workbench/axi-workbench/services/api-gateway/ratelimit/limiter.go` — rate limit abstraction to preserve

## Open questions

1. Should the `core-service` Java/Spring coordination use gRPC by stage 3, or stay on HTTP+JSON? (Tracked separately; not blocking this ADR.)
2. Should `axilog`'s JSON shape be reimplemented in Rust, or should we move the whole fleet to `tracing-subscriber::fmt::json()` and update Loki ingest? (Tracked separately.)
3. Should we publish `api-gateway-rs` as a workspace member of a future `foundation/axi-workspace-rs/` monorepo? (Yes for stage 3; tracked in ADR-011 follow-up.)