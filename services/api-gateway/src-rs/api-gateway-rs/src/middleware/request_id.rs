//! `request_id` middleware stub.
//!
//! Stage-2 implementation will mirror
//! `workbench/axi-workbench/services/api-gateway/middleware/logging.go`'s
//! `RequestID()` (read incoming `X-Request-ID`, generate a 16-byte hex value
//! otherwise, echo it on the response).

use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response as AxumResponse;

/// Stage-1 stub layer factory — no-op identity passthrough.
pub fn layer() -> tower::layer::util::Identity {
    tower::layer::util::Identity::new()
}

/// Stage-1 stub `pub async fn middleware(...)`. Stage 2 will swap this for a
/// `tower::Layer` implementation that wraps the existing tower-http
/// `SetRequestIdLayer` + `PropagateRequestIdLayer` stack.
pub async fn middleware(req: Request, next: Next) -> AxumResponse {
    next.run(req).await
}