//! `rate_limit` middleware stub.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/rate_limit.go`
//! which wraps a `ratelimit.Limiter` (memory or Redis) keyed by client IP.
//!
//! Stage-2: replace the no-op layer with `governor::RateLimiter` (memory) or
//! a Redis-backed fixed-window (multi-instance parity).

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