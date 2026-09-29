# API Gateway Rust Migration — HANDOFF

## Current state

This is the **stage 1 scaffold** of ADR-017. The Go binary under
`workbench/axi-workbench/services/api-gateway/cmd/gateway/` remains the
production default; the Rust crate is opt-in via the
`API_GATEWAY_PORT` env var on a parallel deployment.

### What landed in this revision

- `docs/adr/ADR-017-api-gateway-rust-migration.md` — the decision record
- `src-rs/api-gateway-rs/Cargo.toml` — crate manifest (axum 0.7, tokio, tower, tower-http)
- `src-rs/api-gateway-rs/src/lib.rs` — library root exposing `router`, `middleware`, `upstream`
- `src-rs/api-gateway-rs/src/router.rs` — full routing table mirrored 1:1 from `config/routes.yaml`, plus `AppState`
- `src-rs/api-gateway-rs/src/upstream.rs` — `UpstreamService` + `UpstreamType` + `UpstreamError` + `call(...)` stub
- `src-rs/api-gateway-rs/src/middleware/` — five middleware stubs (`rate_limit`, `circuit_breaker`, `auth`, `logging`, `tracing`) plus `cors` and `request_id` (the two chain-layer middlewares that do not have a stub `pub async fn middleware` form because `tower_http` already ships them)
- `src-rs/api-gateway-rs/src/bin/api-gateway.rs` — main entry, port 8080, graceful shutdown on SIGINT/SIGTERM

The scaffold compiles cleanly under `cargo check` (verified manually). It
has NOT been built or run by CI; the Rust toolchain is not yet wired into
the api-gateway GitHub workflow.

## Routing table alignment points

The hard-coded routing table in `src/router.rs` mirrors
`config/routes.yaml` row-by-row. The five protected / wildcard route
families below must stay byte-identical between the Go and Rust binaries:

| Path family                       | Go handler           | Rust handler (stage 1 stub) |
|-----------------------------------|----------------------|-----------------------------|
| `/api/v1/auth/**`                 | Session / OIDC       | `session`, `oidc_*`, ...    |
| `/api/v1/sessions/**`             | Session / Resume     | `sessions_*`               |
| `/api/v1/users/me`                | Session              | `users_me`                 |
| `/api/v1/tenants/**`              | ProxyToPlatform      | `tenants_*` (stage 2)      |
| `/api/v1/files/**`                | ProxyToFile          | `files_proxy` (stage 2)    |
| `/api/v1/workflows/**`            | ProxyToWorkflow      | `workflow_*` (stage 2)     |
| `/api/v1/notifications/**`        | ProxyToNotification  | `notifications_*` (stage 2)|
| `/api/v1/control-plane/**`        | ProxyWebControl      | `control_plane_proxy` (stage 2) |
| `/api/v1/mobile/**`               | MobileControlProxy   | `mobile_proxy` (stage 2)   |
| `/api/v1/commit-ledger/**`        | ProxyToControlPlane  | `commit_ledger_proxy` (stage 2) |
| `/api/v1/internal/**`             | InternalToken        | `internal_*` (stage 2)    |

Health (`/health`, `/ready`) and admin (`/api/v1/admin/**`) are
already implemented in the scaffold.

## Middleware chain order — DO NOT REORDER

The Go `setupRouter` registers, top-to-bottom:

1. `gin.Recovery()`            → catch_panic (axum default)
2. `middleware.RequestID()`    → `tower_http::request_id::SetRequestIdLayer`
3. `middleware.TraceContext()` → `middleware::tracing::layer`
4. `observability.Gin(...)`    → `middleware::logging::layer`
5. `middleware.Logger(logger)` → `middleware::logging::layer`
6. `middleware.CORS(...)`      → `middleware::cors::layer`
7. `middleware.RateLimit(...)` → `middleware::rate_limit::layer`
8. `middleware.Audit(logger)`  → stage-2 layer

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

## Next stage (stage 2)

The next engineer picking this up should:

1. Replace `rate_limit::layer()` with a real `governor::RateLimiter`
   keyed by `ConnectInfo<SocketAddr>` (memory backend) and a
   Redis-backed fixed-window for multi-instance parity.
2. Replace `circuit_breaker::layer()` with a per-upstream state machine
   in `Arc<RwLock<CircuitState>>`. Mirror the Go `circuitbreaker`
   package thresholds: open after 5 consecutive 5xx, half-open after
   30s, close after 3 successful probes.
3. Replace `auth::middleware` with `jsonwebtoken`-based JWKS validation
   plus the Redis session-store path from `identity/store.go`.
4. Replace `logging::middleware` with structured `tracing::info!` events
   keeping the `axilog` JSON shape so Loki ingest keeps working.
5. Replace `tracing::middleware` with W3C `traceparent` generation +
   `opentelemetry-otlp` export (gated behind the `tracing-otel`
   feature).

## Stage 3 (post-stage 2)

- Port `discovery.Manager` to Rust (`consul`, `k8s`, `static` backends)
- Port `gateway.DynamicRouter` hot-reload to `notify` + `tokio::sync::watch`
- Wire dynamic router into `build_router()` so the admin REST surface
  (`/api/v1/admin/routes/**`) actually mutates routes at runtime
- 50/50 shadow traffic for 14 days, then cutover

## Verification (stage 1)

- `cargo check --manifest-path src-rs/api-gateway-rs/Cargo.toml` (manual)
- `cargo build --manifest-path src-rs/api-gateway-rs/Cargo.toml` (deferred until stage 2 lands)
- `cargo test` (deferred until stage 2)
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
4. `src-rs/api-gateway-rs/src/upstream.rs`
5. `cmd/gateway/main.go` (the Go binary this replaces)
6. `config/routes.yaml` (source of truth for the routing table)