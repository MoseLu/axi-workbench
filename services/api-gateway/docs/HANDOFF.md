# API Gateway Rust Migration — HANDOFF

## Current state

This is the **stage 2 (core middleware)** revision of ADR-017. The Go binary
under `workbench/axi-workbench/services/api-gateway/cmd/gateway/` remains the
production default; the Rust crate is opt-in via the
`API_GATEWAY_PORT` env var on a parallel deployment.

### What landed in this revision (stage 2)

- `src-rs/api-gateway-rs/src/middleware/rate_limit.rs` — real governor-backed
  in-memory token-bucket limiter. `RateLimitConfig { per_second, burst }`
  with the same 429 envelope the Go binary emits
  (`{"error":"rate limit exceeded"}` + `Retry-After: 1` +
  `X-RateLimit-Remaining: 0`).
- `src-rs/api-gateway-rs/src/middleware/circuit_breaker.rs` — three-state
  machine (`Closed` / `Open` / `HalfOpen`) with per-upstream isolation via
  `CircuitRegistry`. Mirrors Go `circuitbreaker.Config` thresholds
  (`failure_threshold=5`, `timeout=30s`, `half_open_max=2`) and returns the
  same `{error,message,target}` JSON envelope on Open.
- `src-rs/api-gateway-rs/src/middleware/auth.rs` — `jsonwebtoken` JWKS
  verifier. Refresh-on-miss JWKS cache, bearer-token extraction, 401 on
  missing/invalid token, 503 on JWKS outage — same envelopes as the Go
  `RequireIdentity` middleware.
- `src-rs/api-gateway-rs/src/metrics.rs` — Prometheus exporter. Exposes
  `axi_api_gateway_requests_total{path,method,status}`,
  `axi_api_gateway_request_duration_seconds{path,method}`,
  `axi_api_gateway_circuit_state{upstream}`,
  `axi_api_gateway_rate_limit_decisions_total{outcome}`, and
  `axi_api_gateway_upstreams_configured`. Metric names match the Go binary so
  dashboards / alerts don't move.
- `src-rs/api-gateway-rs/src/bin/api-gateway.rs` — wires the `/metrics`
  endpoint into the main router and exposes a test helper `bind_for_test()`
  that returns the ephemeral bind address + `Arc<Metrics>` handle.
- `src-rs/api-gateway-rs/tests/test_circuit_breaker.rs` — 32 tests covering
  state transitions, failure-threshold accuracy, open-duration timing,
  per-upstream isolation, concurrency, force-close, and registry helpers.
- `src-rs/api-gateway-rs/tests/test_rate_limit.rs` — 20 tests covering
  burst capacity, 429 envelope, GCRA semantics, and async/threaded
  admission.

### What landed in stage 1 (kept verbatim)

- `docs/adr/ADR-017-api-gateway-rust-migration.md` — the decision record
  (now `Status: Accepted (Stage 2)`)
- `src-rs/api-gateway-rs/Cargo.toml` — crate manifest (axum 0.7, tokio,
  tower, tower-http)
- `src-rs/api-gateway-rs/src/lib.rs` — library root exposing `router`,
  `middleware`, `upstream`, and the new `metrics` module
- `src-rs/api-gateway-rs/src/router.rs` — full routing table mirrored 1:1
  from `config/routes.yaml`, plus `AppState`
- `src-rs/api-gateway-rs/src/upstream.rs` — `UpstreamService` +
  `UpstreamType` + `UpstreamError` + `call(...)` stub
- `src-rs/api-gateway-rs/src/middleware/{cors,logging,request_id,tracing}.rs`
  — the other four chain-layer middlewares (still stubs in stage 2)

Verification status: `cargo check` clean, `cargo test` 52/52 passing.

## Routing table alignment points

The hard-coded routing table in `src/router.rs` mirrors
`config/routes.yaml` row-by-row. The five protected / wildcard route
families below must stay byte-identical between the Go and Rust binaries:

| Path family                       | Go handler           | Rust handler (stage 1 stub) |
|-----------------------------------|----------------------|-----------------------------|
| `/api/v1/auth/**`                 | Session / OIDC       | `session`, `oidc_*`, ...    |
| `/api/v1/sessions/**`             | Session / Resume     | `sessions_*`               |
| `/api/v1/users/me`                | Session              | `users_me`                 |
| `/api/v1/tenants/**`              | ProxyToPlatform      | `tenants_*` (stage 3)      |
| `/api/v1/files/**`                | ProxyToFile          | `files_proxy` (stage 3)    |
| `/api/v1/workflows/**`            | ProxyToWorkflow      | `workflow_*` (stage 3)     |
| `/api/v1/notifications/**`        | ProxyToNotification  | `notifications_*` (stage 3)|
| `/api/v1/control-plane/**`        | ProxyWebControl      | `control_plane_proxy` (stage 3) |
| `/api/v1/mobile/**`               | MobileControlProxy   | `mobile_proxy` (stage 3)   |
| `/api/v1/commit-ledger/**`        | ProxyToControlPlane  | `commit_ledger_proxy` (stage 3) |
| `/api/v1/internal/**`             | InternalToken        | `internal_*` (stage 3)    |

Health (`/health`, `/ready`), Prometheus (`/metrics`), and admin
(`/api/v1/admin/**`) are already implemented in the scaffold.

## Middleware chain order — DO NOT REORDER

The Go `setupRouter` registers, top-to-bottom:

1. `gin.Recovery()`            → catch_panic (axum default)
2. `middleware.RequestID()`    → `tower_http::request_id::SetRequestIdLayer`
3. `middleware.TraceContext()` → `middleware::tracing::layer`
4. `observability.Gin(...)`    → `middleware::logging::layer`
5. `middleware.Logger(logger)` → `middleware::logging::layer`
6. `middleware.CORS(...)`      → `middleware::cors::layer`
7. `middleware.RateLimit(...)` → `middleware::rate_limit::layer` (real in stage 2)
8. `middleware.Audit(logger)`  → stage-3 layer

`middleware::chain_order()` in `src/middleware/mod.rs` records the
intended Rust order. Any reordering requires a new ADR.

## 12-sibling-service forwarding table

`src/upstream.rs::UpstreamService::defaults_from_env()` mirrors the
upstream constructor in `cmd/gateway/main.go`:

| # | name                  | kind            | env var                       |
|---|-----------------------|-----------------|-------------------------------|
| 1 | identity-adapter      | Identity        | `IDENTITY_ADAPTER_URL`        |
| 2 | platform-core         | Platform        | `PLATFORM_CORE_URL`           |
| 3 | core-service (Java)   | LegacyCore      | `LEGACY_CORE_SERVICE_URL`     |
| 4 | file-service          | File            | `FILE_SERVICE_URL`            |
| 5 | workflow-engine       | Workflow        | `WORKFLOW_URL`                |
| 6 | notification-service  | Notification    | `NOTIFICATION_URL`            |
| 7 | control-plane (web)   | ControlPlane    | `CONTROL_PLANE_URL`           |
| 8 | mobile-control plane  | MobileControl    | `CONTROL_PLANE_URL` (shared)  |

Services #9–#12 (`auth-service`, `communication-gateway`,
`resource-gateway`, `agent-runtime`) are reached transitively through
`control-plane` and do not need a direct upstream entry — same as in the
Go binary.

## Java `core-service` coordination

`core-service` is the only sibling written in Java/Spring. Its HTTP
contract is the public surface for tenants, dictionaries, members and
preferences. The Rust migration does not change that contract; the same
JSON shapes are proxied through unchanged.

What changes in stage 3:

- The `core-service` upstream is now `UpstreamType::LegacyCore` with env
  var `LEGACY_CORE_SERVICE_URL`. The Go binary uses the same name.
- If `core-service` later exposes a gRPC interface (tracked separately,
  not in this ADR), the Rust gateway will gain a `tower::Service` impl
  that fronts both HTTP and gRPC without changing the public route
  surface.

## Stage 3 (post-stage 2)

- Port `discovery.Manager` to Rust (`consul`, `k8s`, `static` backends)
- Port `gateway.DynamicRouter` hot-reload to `notify` + `tokio::sync::watch`
- Wire dynamic router into `build_router()` so the admin REST surface
  (`/api/v1/admin/routes/**`) actually mutates routes at runtime
- Replace `upstream::call` stub with a real `hyper` client that consults
  the per-upstream circuit breaker on every forward
- Real `RequireInternalToken` filter on `/api/v1/internal/**` (Go has it
  today)
- Per-IP rate-limit keying (DashMap state store keyed by
  `ConnectInfo<SocketAddr>`)
- 50/50 shadow traffic for 14 days, then cutover

## Verification (stage 2)

- `cargo check --manifest-path src-rs/api-gateway-rs/Cargo.toml --all-targets` clean
- `cargo test  --manifest-path src-rs/api-gateway-rs/Cargo.toml` → **52 passed, 0 failed**
  - `tests/test_circuit_breaker.rs`: 32 passed
  - `tests/test_rate_limit.rs`: 20 passed
- Existing Go binary unchanged: `go build ./...` should still succeed.

## Open questions

1. Should the Rust crate move under `foundation/axi-workspace-rs/` once
   that monorepo exists? Yes — tracked in ADR-011 follow-up.
2. Should `axilog`'s JSON shape be reimplemented in Rust, or should the
   whole fleet migrate to `tracing-subscriber::fmt::json()`? Tracked
   separately; not blocking this revision.
3. Does the `mobile-control` upstream deserve its own env var, or is
   sharing `CONTROL_PLANE_URL` good enough? Current implementation
   shares; revisit if mobile control becomes independently deployable.

## Files for the next engineer to read first

1. `docs/adr/ADR-017-api-gateway-rust-migration.md`
2. `src-rs/api-gateway-rs/src/router.rs`
3. `src-rs/api-gateway-rs/src/middleware/mod.rs` (chain order is the contract)
4. `src-rs/api-gateway-rs/src/middleware/{rate_limit,circuit_breaker,auth}.rs`
5. `src-rs/api-gateway-rs/src/metrics.rs`
6. `src-rs/api-gateway-rs/src/upstream.rs`
7. `cmd/gateway/main.go` (the Go binary this replaces)
8. `config/routes.yaml` (source of truth for the routing table)