//! `circuit_breaker` middleware stub.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/circuitbreaker.go`
//! which wraps upstream calls in a per-target circuit breaker.
//!
//! Stage-2: implement the three-state machine (closed / open / half-open)
//! backed by `Arc<RwLock<CircuitState>>` per upstream.

/// Layer factory — currently a no-op identity passthrough.
pub fn layer() -> tower::layer::util::Identity {
    tower::layer::util::Identity::new()
}

/// Stage-1 stub `pub async fn middleware(...)`.
pub async fn middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    next.run(req).await
}