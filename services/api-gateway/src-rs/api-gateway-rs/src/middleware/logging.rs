//! `logging` middleware stub.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/logging.go`
//! `Logger(logger)` which logs `(method, path, status, latency, client_ip)`
//! per request using `slog`.
//!
//! Stage-2: emit `tracing::info!` events with structured fields compatible
//! with the existing `axilog` JSON shape (Loki ingest contract).

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