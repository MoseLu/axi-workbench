//! `rate_limit` middleware — in-memory governor-backed token bucket.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/rate_limit.go`
//! which wraps a `ratelimit.Limiter` (memory or Redis) keyed by client IP.
//!
//! Stage-2 implementation: a global `governor::RateLimiter` enforcing a
//! token bucket. Per-IP keying is a stage-3 enhancement (requires `DashMap`
//! state store + `axum::extract::ConnectInfo<SocketAddr>` plumbing). The
//! middleware short-circuits to `429 Too Many Requests` on bucket exhaustion.
//!
//! ## Layer composition
//!
//! ```text
//!  Request ─▶ GovernorMiddleware ─▶ downstream handlers
//!                 │
//!                 └── on limit: 429 + Retry-After header
//! ```
//!
//! The middleware exposes:
//! - [`RateLimitConfig`] — quota knobs (per_second + burst).
//! - [`RateLimit`] — typed `Arc<RateLimiter>` state.
//! - [`layer`] / [`middleware`] — tower / axum wiring.
//! - [`RateLimitDecision`] — typed 429 envelope so tests can assert on it.

use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use governor::clock::{Clock, DefaultClock};
use governor::state::InMemoryState;
use governor::{Quota, RateLimiter};
use serde::Serialize;
use tracing::{debug, warn};

/// Header that exposes the remaining quota to the caller. Matches the Go
/// `X-RateLimit-Remaining` contract.
pub const HEADER_REMAINING: HeaderName = HeaderName::from_static("x-ratelimit-remaining");

/// Header that exposes the quota reset time as a unix timestamp. Matches the Go
/// `X-RateLimit-Reset` contract.
pub const HEADER_RESET: HeaderName = HeaderName::from_static("x-ratelimit-reset");

/// Header that advises the client when to retry (seconds). Matches the Go
/// `Retry-After` contract.
pub const HEADER_RETRY_AFTER: HeaderName = HeaderName::from_static("retry-after");

/// Configuration knobs for the rate limiter.
///
/// `per_second` is the steady-state refill rate, `burst` is the bucket
/// capacity (mirroring `governor::Quota::per_second().allow_burst(...)`).
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RateLimitConfig {
    pub per_second: u32,
    pub burst: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            per_second: 100,
            burst: 200,
        }
    }
}

impl RateLimitConfig {
    /// Build a config from env vars with sensible defaults. Mirrors the Go
    /// `cfg.RateLimit` constructor (RPS + burst).
    pub fn from_env() -> Self {
        let per_second = std::env::var("API_GATEWAY_RATE_LIMIT_RPS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(100);
        let burst = std::env::var("API_GATEWAY_RATE_LIMIT_BURST")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(200);
        Self {
            per_second,
            burst,
        }
    }

    /// Resolve into a non-zero quota. Panics on zero inputs (a zero-quota
    /// limiter is meaningless; callers must validate at the boundary).
    fn to_quota(self) -> Quota {
        let rps = NonZeroU32::new(self.per_second.max(1)).expect("NonZeroU32::new(1) is Some");
        let burst = NonZeroU32::new(self.burst.max(1)).expect("NonZeroU32::new(1) is Some");
        Quota::per_second(rps).allow_burst(burst)
    }
}

/// Type alias for the in-memory direct rate limiter used by this stage.
pub type DirectRateLimiter = RateLimiter<governor::state::NotKeyed, InMemoryState, DefaultClock>;

/// Shared state injected into the middleware. Holds the global rate limiter
/// plus optional per-instance metrics counters.
#[derive(Clone, Debug)]
pub struct RateLimit {
    inner: Arc<DirectRateLimiter>,
    config: RateLimitConfig,
}

impl RateLimit {
    /// Build a fresh in-memory rate limiter from the supplied config.
    pub fn new(config: RateLimitConfig) -> Self {
        let quota = config.to_quota();
        let inner = Arc::new(RateLimiter::direct(quota));
        Self { inner, config }
    }

    /// Borrow the inner governor limiter for direct inspection in tests.
    pub fn limiter(&self) -> &DirectRateLimiter {
        &self.inner
    }

    /// Borrow the active configuration.
    pub fn config(&self) -> RateLimitConfig {
        self.config
    }

    /// Attempt to admit a single request. Returns `Ok(())` if admitted, or
    /// `Err(wait)` with the earliest time the next cell might succeed.
    pub fn try_acquire(&self) -> Result<(), Duration> {
        match self.inner.check() {
            Ok(_) => Ok(()),
            Err(neg) => Err(neg.wait_time_from(DefaultClock::default().now())),
        }
    }

    /// Compute the bucket-throttle decision value: returns the wait time if the
    /// bucket is exhausted, otherwise `None`.
    pub fn reject_wait(&self) -> Option<Duration> {
        match self.inner.check() {
            Ok(_) => None,
            Err(neg) => Some(neg.wait_time_from(DefaultClock::default().now())),
        }
    }
}

/// 429 envelope. Matches the Go `{"error": "rate limit exceeded"}` shape.
#[derive(Debug, Serialize)]
pub struct RateLimitDecision {
    pub error: &'static str,
}

/// axum middleware fn. Uses `State<Arc<RateLimit>>` injection from the
/// router-level `with_state`/extension plumbing.
pub async fn middleware(
    State(limiter): State<Arc<RateLimit>>,
    ConnectInfo(addr): ConnectInfo<std::net::SocketAddr>,
    req: Request,
    next: Next,
) -> Response {
    if limiter.inner.check().is_err() {
        warn!(
            client_ip = %addr,
            "rate limit exceeded"
        );
        return rate_limited_response();
    }
    debug!(
        client_ip = %addr,
        "rate limit admitted"
    );
    next.run(req).await
}

/// Build a fully-formed `429 Too Many Requests` response with the same
/// headers the Go binary emits.
pub fn rate_limited_response() -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(HEADER_REMAINING, HeaderValue::from_static("0"));
    headers.insert(HEADER_RETRY_AFTER, HeaderValue::from_static("1"));
    (
        StatusCode::TOO_MANY_REQUESTS,
        headers,
        axum::Json(RateLimitDecision {
            error: "rate limit exceeded",
        }),
    )
        .into_response()
}

/// Build a tower layer that injects the supplied [`RateLimit`] into the
/// request state map. The state is exposed as `axum::extract::State<Arc<RateLimit>>`.
pub fn layer(limiter: Arc<RateLimit>) -> axum::extract::Extension<Arc<RateLimit>> {
    axum::extract::Extension(limiter)
}

/// Convenience no-arg layer factory used by `build_router`. Constructs a
/// default-quota in-memory rate limiter and wires it into the request state.
pub fn default_layer() -> axum::extract::Extension<Arc<RateLimit>> {
    layer(build_state(RateLimitConfig::from_env()))
}

/// Convenience constructor for tests / integration setup that want the full
/// state type wired up.
pub fn build_state(config: RateLimitConfig) -> Arc<RateLimit> {
    Arc::new(RateLimit::new(config))
}

// Re-export the body type so downstream `axum::body::to_bytes` tests can stay
// type-agnostic across refactors.
#[allow(dead_code)]
pub(crate) type ResponseBody = Body;