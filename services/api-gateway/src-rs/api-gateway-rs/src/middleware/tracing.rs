//! `tracing` middleware stub — W3C `traceparent` propagation.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/trace.go`
//! `TraceContext()` which preserves an existing valid `traceparent` header
//! or generates a new one in W3C Trace Context format
//! `00-<trace-id>-<span-id>-01`.
//!
//! Stage-2: integrate `opentelemetry` + `opentelemetry-otlp` (gated behind
//! the `tracing-otel` feature) and `tracing_opentelemetry` for spans.

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