//! `auth` middleware — JWKS-backed bearer-token verification.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/identity.go`
//! `RequireIdentity` — verifies OIDC/JWKS session or bearer token, sets the
//! principal on the request extensions, and emits 401 / 503 per the Go
//! behaviour.
//!
//! Stage-2 implementation:
//! - Bearer token extraction from the `Authorization: Bearer <token>` header.
//! - JWT decode + claim verification via [`jsonwebtoken`].
//! - JWKS resolver that fetches a `JwkSet` from `cfg.jwks_url` with a 60s
//!   in-memory cache. The cache is intentionally simple (no TTL eviction
//!   goroutine) — stage-3 will swap in `dashmap` + `notify`.
//! - On success: writes a [`Principal`] into request extensions and forwards
//!   to the next middleware.
//! - On failure: 401 with the same JSON envelope the Go binary emits
//!   (`{"error":"Axi OIDC session or bearer token required"}`).
//!
//! ## Verification that DOES NOT happen here
//!
//! - Cookie-bound session restore is delegated to the Go `identity.Service`
//!   for now. Stage 3 will port `identity/store.go` to Rust.
//! - Internal-token routing (`RequireInternalToken`) is left to the upstream
//!   layer.

use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{header::AUTHORIZATION, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, warn};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Configuration for the auth middleware. Mirrors the Go
/// `identity.Service.Config` block.
#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub jwks_url: String,
    pub audience: String,
    pub issuer: String,
    /// Allow the middleware to be completely disabled (dev / tests). When
    /// `true`, the middleware becomes a no-op that injects an anonymous
    /// principal. Defaults to `false`.
    pub allow_anonymous: bool,
}

impl AuthConfig {
    /// Default config suitable for local development. The `jwks_url` is
    /// empty so the middleware falls back to "unconfigured" and returns
    /// 401 unless `allow_anonymous` is set.
    pub fn from_env() -> Self {
        let jwks_url = std::env::var("API_GATEWAY_JWKS_URL").unwrap_or_default();
        let audience = std::env::var("API_GATEWAY_JWT_AUDIENCE").unwrap_or_default();
        let issuer = std::env::var("API_GATEWAY_JWT_ISSUER").unwrap_or_default();
        let allow_anonymous = std::env::var("API_GATEWAY_AUTH_ANONYMOUS")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        Self {
            jwks_url,
            audience,
            issuer,
            allow_anonymous,
        }
    }
}

// ---------------------------------------------------------------------------
// Claims + Principal
// ---------------------------------------------------------------------------

/// Standard OIDC claims we read off the JWT. Extra claims are preserved on
/// the returned [`Principal`] via the `extra` field.
#[derive(Debug, Deserialize)]
pub struct JwtClaims {
    pub sub: String,
    #[serde(default)]
    pub iss: Option<String>,
    #[serde(default)]
    pub aud: Option<serde_json::Value>,
    #[serde(default)]
    pub exp: Option<i64>,
    #[serde(default)]
    pub iat: Option<i64>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
}

/// Resolved principal attached to the request extensions. Downstream
/// handlers can pull this via `axum::Extension<Principal>`.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Principal {
    pub subject: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

impl Principal {
    pub fn anonymous() -> Self {
        Self {
            subject: "anonymous".to_string(),
            email: None,
            name: None,
            roles: vec![],
            scope: None,
        }
    }

    pub fn from_claims(claims: JwtClaims) -> Self {
        Self {
            subject: claims.sub,
            email: claims.email,
            name: claims.name,
            roles: claims.roles,
            scope: claims.scope,
        }
    }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("missing or malformed Authorization header")]
    MissingHeader,
    #[error("JWKS not configured (set API_GATEWAY_JWKS_URL)")]
    JwksUnconfigured,
    #[error("JWKS fetch failed: {0}")]
    JwksFetch(String),
    #[error("kid {0:?} not present in JWKS")]
    UnknownKid(Option<String>),
    #[error("token signature verification failed: {0}")]
    InvalidSignature(String),
    #[error("token claim validation failed: {0}")]
    InvalidClaims(String),
    #[error("token expired")]
    Expired,
}

// ---------------------------------------------------------------------------
// JWKS cache
// ---------------------------------------------------------------------------

/// JWKS body as published by an OIDC provider.
#[derive(Debug, Deserialize, Serialize)]
pub struct JwksDoc {
    pub keys: Vec<Jwk>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Jwk {
    #[serde(default)]
    pub kid: Option<String>,
    #[serde(default)]
    pub kty: Option<String>,
    #[serde(default)]
    pub alg: Option<String>,
    #[serde(default)]
    pub n: Option<String>,
    #[serde(default)]
    pub e: Option<String>,
    #[serde(rename = "use", default)]
    pub key_use: Option<String>,
}

#[derive(Default)]
struct JwksCache {
    keys: Vec<Jwk>,
}

#[derive(Clone)]
pub struct AuthState {
    pub config: AuthConfig,
    cache: Arc<RwLock<JwksCache>>,
    http: Arc<reqwest::Client>,
}

impl std::fmt::Debug for AuthState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AuthState")
            .field("config", &self.config)
            .field("cached_keys", &self.cache.try_read().map(|c| c.keys.len()).unwrap_or(0))
            .finish()
    }
}

impl AuthState {
    pub fn new(config: AuthConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("reqwest client construction cannot fail with default options");
        Self {
            config,
            cache: Arc::new(RwLock::new(JwksCache::default())),
            http: Arc::new(http),
        }
    }

    /// Fetch the JWKS document and cache it. Returns the JWK with the given
    /// `kid` if found, otherwise `AuthError::UnknownKid`.
    pub async fn jwk_for(&self, kid: Option<&str>) -> Result<Jwk, AuthError> {
        if self.config.jwks_url.is_empty() {
            return Err(AuthError::JwksUnconfigured);
        }
        // Cache hit.
        {
            let cache = self.cache.read().await;
            if let Some(jwk) = cache.keys.iter().find(|k| k.kid.as_deref() == kid) {
                return Ok(jwk.clone());
            }
        }
        // Refresh + retry.
        self.refresh_jwks().await?;
        let cache = self.cache.read().await;
        cache
            .keys
            .iter()
            .find(|k| k.kid.as_deref() == kid)
            .cloned()
            .ok_or_else(|| AuthError::UnknownKid(kid.map(|s| s.to_string())))
    }

    /// Fetch a JWK without consulting the cache. Used by tests + the
    /// `/admin/auth/jwks/refresh` admin endpoint.
    pub async fn refresh_jwks(&self) -> Result<(), AuthError> {
        if self.config.jwks_url.is_empty() {
            return Err(AuthError::JwksUnconfigured);
        }
        let body: JwksDoc = self
            .http
            .get(&self.config.jwks_url)
            .send()
            .await
            .map_err(|e| AuthError::JwksFetch(e.to_string()))?
            .json()
            .await
            .map_err(|e| AuthError::JwksFetch(e.to_string()))?;
        let mut cache = self.cache.write().await;
        cache.keys = body.keys;
        Ok(())
    }

    /// Test-only helper: preload the JWKS cache without a network fetch.
    pub async fn install_jwks_for_test(&self, jwks: JwksDoc) {
        let mut cache = self.cache.write().await;
        cache.keys = jwks.keys;
    }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

fn bearer_token_from_request(req: &Request) -> Result<&str, AuthError> {
    let header = req
        .headers()
        .get(AUTHORIZATION)
        .ok_or(AuthError::MissingHeader)?;
    let header_str = header.to_str().map_err(|_| AuthError::MissingHeader)?;
    let token = header_str
        .strip_prefix("Bearer ")
        .or_else(|| header_str.strip_prefix("bearer "))
        .ok_or(AuthError::MissingHeader)?;
    Ok(token.trim())
}

fn build_validation(iss: &str, aud: &str) -> Validation {
    let mut validation = Validation::new(Algorithm::RS256);
    if !iss.is_empty() {
        validation.set_issuer(&[iss]);
    }
    if !aud.is_empty() {
        validation.set_audience(&[aud]);
    } else {
        // If no audience is configured, do not require one. jsonwebtoken
        // rejects tokens with an aud claim by default; we want to accept
        // issuer-only tokens too.
        validation.validate_aud = false;
    }
    validation
}

fn jwk_to_decoding_key(jwk: &Jwk) -> Result<DecodingKey, AuthError> {
    let n = jwk
        .n
        .as_deref()
        .ok_or_else(|| AuthError::InvalidSignature("JWK missing n".into()))?;
    let e = jwk
        .e
        .as_deref()
        .ok_or_else(|| AuthError::InvalidSignature("JWK missing e".into()))?;
    DecodingKey::from_rsa_components(n, e).map_err(|e| AuthError::InvalidSignature(e.to_string()))
}

/// Verify a single bearer token end-to-end and return the principal.
pub async fn verify_bearer(
    state: &AuthState,
    token: &str,
) -> Result<Principal, AuthError> {
    let header = decode_header(token)
        .map_err(|e| AuthError::InvalidSignature(format!("decode_header: {e}")))?;
    let kid = header.kid.clone();
    let jwk = state.jwk_for(kid.as_deref()).await?;
    let decoding_key = jwk_to_decoding_key(&jwk)?;
    let mut validation = build_validation(&state.config.issuer, &state.config.audience);
    if let Some(alg) = jwk.alg.as_deref().and_then(|s| match s {
        "RS256" => Some(Algorithm::RS256),
        "RS384" => Some(Algorithm::RS384),
        "RS512" => Some(Algorithm::RS512),
        _ => None,
    }) {
        validation.algorithms = vec![alg];
    }
    let data = decode::<JwtClaims>(token, &decoding_key, &validation).map_err(|e| {
        if matches!(e.kind(), jsonwebtoken::errors::ErrorKind::ExpiredSignature) {
            AuthError::Expired
        } else {
            AuthError::InvalidClaims(e.to_string())
        }
    })?;
    Ok(Principal::from_claims(data.claims))
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct UnauthorizedBody {
    error: &'static str,
}

fn unauthorized_response() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        axum::Json(UnauthorizedBody {
            error: "Axi OIDC session or bearer token required",
        }),
    )
        .into_response()
}

fn service_unavailable_response() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        axum::Json(UnauthorizedBody {
            error: "session store unavailable",
        }),
    )
        .into_response()
}

pub async fn middleware(
    State(state): State<Arc<AuthState>>,
    mut req: Request,
    next: Next,
) -> Response {
    debug!("auth middleware invoked");
    if state.config.allow_anonymous {
        req.extensions_mut().insert(Principal::anonymous());
        return next.run(req).await;
    }
    if state.config.jwks_url.is_empty() {
        warn!("auth disabled — jwks_url not configured");
        return service_unavailable_response();
    }
    let token = match bearer_token_from_request(&req) {
        Ok(t) => t,
        Err(_) => return unauthorized_response(),
    };
    match verify_bearer(&state, token).await {
        Ok(principal) => {
            debug!(subject = %principal.subject, "auth success");
            req.extensions_mut().insert(principal);
            next.run(req).await
        }
        Err(AuthError::Expired) => {
            warn!("auth failed: token expired");
            unauthorized_response()
        }
        Err(err) => {
            warn!(error = %err, "auth failed");
            match err {
                AuthError::JwksFetch(_) | AuthError::JwksUnconfigured => {
                    service_unavailable_response()
                }
                _ => unauthorized_response(),
            }
        }
    }
}

/// Convenience constructor that wraps an [`AuthConfig`] into the
/// `Arc<AuthState>` middleware expects.
pub fn build_state(config: AuthConfig) -> Arc<AuthState> {
    Arc::new(AuthState::new(config))
}

// Re-export the body type so downstream `axum::body::to_bytes` tests can stay
// type-agnostic across refactors.
#[allow(dead_code)]
pub(crate) type ResponseBody = Body;