//! Middleware chain — five stubs that mirror the Go `setupRouter` order.
//!
//! Every stub in this module is a no-op `tower::Layer` factory. The real
//! implementations land in stage 2 of ADR-017:
//!
//! 1. `rate_limit` — governor / Redis-backed
//! 2. `circuit_breaker` — per-upstream state machine
//! 3. `auth` — OIDC/JWKS verification
//! 4. `logging` — request/response tracing
//! 5. `tracing` — W3C traceparent generation + propagation
//!
//! The chain order is the contract. Reordering requires a new ADR.

pub mod auth;
pub mod circuit_breaker;
pub mod cors;
pub mod logging;
pub mod rate_limit;
pub mod request_id;
pub mod tracing;

pub use auth::middleware as auth_middleware;
pub use circuit_breaker::middleware as circuit_breaker_middleware;
pub use logging::middleware as logging_middleware;
pub use rate_limit::middleware as rate_limit_middleware;
pub use tracing::middleware as tracing_middleware;

/// Re-exports of every middleware stub as a tuple. The tuple order is the
/// chain order. Reordering requires a new ADR.
pub fn chain_order() -> [&'static str; 7] {
    [
        "request_id",
        "trace_context",
        "logging",
        "cors",
        "rate_limit",
        "circuit_breaker",
        "auth",
    ]
}