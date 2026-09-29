//! `cors` middleware stub.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/cors.go`
//! which configures allowed origins / methods / headers from `cfg.CORS`.
//!
//! Stage-2: build a real `tower_http::cors::CorsLayer` from the same
//! configuration struct used by the Go binary.

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