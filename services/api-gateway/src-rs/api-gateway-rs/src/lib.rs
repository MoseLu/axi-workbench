//! `api-gateway-rs` — Axi Workbench API gateway (Rust migration target).
//!
//! This crate replaces the Go/Gin implementation under
//! `workbench/axi-workbench/services/api-gateway` (see ADR-017). It exposes a
//! library + binary entrypoint. The library root re-exports the three public
//! submodules that own the migration surface:
//!
//! - [`router`] — axum router construction from the same `routes.yaml` the Go
//!   binary consumes.
//! - [`middleware`] — five middleware stubs (rate_limit, circuit_breaker,
//!   auth, logging, tracing) that mirror the Go `setupRouter` chain 1:1.
//! - [`upstream`] — typed representation of every sibling service the gateway
//!   forwards to, plus the `call(...)` stub.
//!
//! The crate intentionally ships only stubs in this revision. Real
//! implementations land in stage 2 / stage 3 of ADR-017.

#![forbid(unsafe_code)]
#![warn(missing_debug_implementations)]

pub mod metrics;
pub mod middleware;
pub mod router;
pub mod upstream;

pub use metrics::{metrics_handler, metrics_router, Metrics};
pub use router::{build_router, AppState};
pub use upstream::{UpstreamError, UpstreamService};