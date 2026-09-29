//! `auth` middleware stub.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/identity.go`
//! `RequireIdentity` — verifies OIDC/JWKS session or bearer token, sets the
//! principal on the request extensions, and emits 401 / 503 per the Go
//! behaviour.
//!
//! Stage-2: integrate `jsonwebtoken` for JWKS validation + Redis session
//! store via the `redis` feature flag.

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