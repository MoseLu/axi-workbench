//! `circuit_breaker` middleware — three-state machine (closed / open / half-open).
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/circuitbreaker.go`
//! which wraps upstream calls in a per-target circuit breaker implemented
//! against `workbench/axi-workbench/services/api-gateway/circuitbreaker/circuitbreaker.go`.
//!
//! ## State transitions
//!
//! ```text
//!        failure_count >= threshold
//!   ┌────────────────────────────────┐
//!   │                                ▼
//! Closed                          Open
//!   ▲                                │
//!   │   success_count >= half_open   │  now - last_state_change
//!   │   max (probe succeeds)         │  >= open_duration
//!   │                                ▼
//!   └──────────────── HalfOpen ──────┘
//!           (any failure ⇒ back to Open)
//! ```
//!
//! Per-upstream state is held in [`CircuitRegistry`], which maps a stable
//! upstream key to an `Arc<CircuitBreaker>`. The middleware in stage 2 is a
//! single-instance global breaker; per-upstream routing requires the stage-3
//! dynamic router to expose a "current upstream" tag on the request
//! extensions.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use std::sync::Mutex;
use thiserror::Error;
use tracing::{debug, info, warn};

// ---------------------------------------------------------------------------
// State machine types
// ---------------------------------------------------------------------------

/// Three states of the circuit breaker. The numeric discriminants are pinned
/// so the Go `State.String()` mapping lines up: 0=closed, 1=open, 2=half_open.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

impl CircuitState {
    /// Numeric encoding that matches the Go prometheus gauge label value.
    pub fn as_u8(self) -> u8 {
        match self {
            CircuitState::Closed => 0,
            CircuitState::Open => 1,
            CircuitState::HalfOpen => 2,
        }
    }
}

/// Inner counters. Held behind a `Mutex` so the breaker can be cheaply shared
/// across axum handler invocations.
#[derive(Debug)]
pub struct CircuitStateInner {
    pub state: CircuitState,
    pub failure_count: u32,
    pub success_count: u32,
    pub last_failure: Option<Instant>,
    pub last_state_change: Instant,
}

impl Default for CircuitStateInner {
    fn default() -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            success_count: 0,
            last_failure: None,
            last_state_change: Instant::now(),
        }
    }
}

/// Configurable knobs. Defaults mirror the Go
/// `circuitbreaker.DefaultConfig` constants.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CircuitBreakerConfig {
    pub failure_threshold: u32,
    pub open_duration: Duration,
    pub half_open_max: u32,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            open_duration: Duration::from_secs(30),
            half_open_max: 2,
        }
    }
}

impl CircuitBreakerConfig {
    /// Build config from env vars, mirroring the Go `cfg.CircuitBreaker`
    /// constructor and the stage-2 ADR-017 thresholds.
    pub fn from_env() -> Self {
        let failure_threshold = std::env::var("API_GATEWAY_CB_FAILURE_THRESHOLD")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);
        let open_secs = std::env::var("API_GATEWAY_CB_OPEN_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(30);
        let half_open_max = std::env::var("API_GATEWAY_CB_HALF_OPEN_MAX")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(2);
        Self {
            failure_threshold,
            open_duration: Duration::from_secs(open_secs),
            half_open_max,
        }
    }
}

/// Outcome of a guarded call.
#[derive(Debug, Error)]
pub enum CircuitError {
    #[error("circuit breaker is open for {target}")]
    Open { target: String },
    #[error("circuit breaker rejected request for {target}")]
    Rejected { target: String },
}

// ---------------------------------------------------------------------------
// CircuitBreaker — the actual state machine
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct CircuitBreaker {
    target: String,
    config: CircuitBreakerConfig,
    inner: Mutex<CircuitStateInner>,
}

impl CircuitBreaker {
    /// Build a fresh breaker in the Closed state.
    pub fn new(target: impl Into<String>, config: CircuitBreakerConfig) -> Self {
        Self {
            target: target.into(),
            config,
            inner: Mutex::new(CircuitStateInner::default()),
        }
    }

    /// Snapshot the current state for tests + observability.
    pub fn state(&self) -> CircuitState {
        self.inner.lock().unwrap().state
    }

    /// Snapshot the counters for tests + observability.
    pub fn snapshot(&self) -> CircuitStateInner {
        let guard = self.inner.lock().unwrap();
        CircuitStateInner {
            state: guard.state,
            failure_count: guard.failure_count,
            success_count: guard.success_count,
            last_failure: guard.last_failure,
            last_state_change: guard.last_state_change,
        }
    }

    /// Returns `true` if the request may proceed through the breaker.
    ///
    /// Side-effect: if the breaker is `Open` and the open-duration has
    /// elapsed, this transitions the breaker to `HalfOpen` and admits the
    /// first probe.
    pub fn allow(&self) -> bool {
        let mut inner = self.inner.lock().unwrap();
        match inner.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                let elapsed = inner.last_state_change.elapsed();
                if elapsed >= self.config.open_duration {
                    inner.state = CircuitState::HalfOpen;
                    inner.success_count = 0;
                    inner.failure_count = 0;
                    inner.last_state_change = Instant::now();
                    info!(
                        target = %self.target,
                        elapsed_secs = elapsed.as_secs(),
                        "circuit breaker transitioning open -> half_open"
                    );
                    true
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    /// Record a successful request. Transitions HalfOpen → Closed when the
    /// success counter reaches `half_open_max`. Resets the Closed failure
    /// counter so a recovering upstream does not race-trip the breaker.
    pub fn record_success(&self) {
        let mut inner = self.inner.lock().unwrap();
        match inner.state {
            CircuitState::Closed => {
                if inner.failure_count > 0 {
                    inner.failure_count -= 1;
                }
            }
            CircuitState::HalfOpen => {
                inner.success_count += 1;
                if inner.success_count >= self.config.half_open_max {
                    inner.state = CircuitState::Closed;
                    inner.failure_count = 0;
                    inner.success_count = 0;
                    inner.last_state_change = Instant::now();
                    info!(
                        target = %self.target,
                        "circuit breaker transitioning half_open -> closed"
                    );
                }
            }
            CircuitState::Open => {
                // Successes cannot arrive while the breaker is open. Treat as
                // a no-op so a stray ack doesn't poison the state.
                debug!(
                    target = %self.target,
                    "stray success recorded while circuit was open (ignored)"
                );
            }
        }
    }

    /// Record a failed request. Closed → Open when the failure counter
    /// reaches the threshold. HalfOpen → Open on any failure (probe failed).
    pub fn record_failure(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.failure_count += 1;
        inner.last_failure = Some(Instant::now());
        match inner.state {
            CircuitState::Closed => {
                if inner.failure_count >= self.config.failure_threshold {
                    inner.state = CircuitState::Open;
                    inner.failure_count = 0;
                    inner.last_state_change = Instant::now();
                    warn!(
                        target = %self.target,
                        threshold = self.config.failure_threshold,
                        "circuit breaker transitioning closed -> open"
                    );
                }
            }
            CircuitState::HalfOpen => {
                inner.state = CircuitState::Open;
                inner.failure_count = 0;
                inner.success_count = 0;
                inner.last_state_change = Instant::now();
                warn!(
                    target = %self.target,
                    "circuit breaker transitioning half_open -> open (probe failed)"
                );
            }
            CircuitState::Open => {
                // Already open; refresh the timer so probe scheduling resets.
                inner.last_state_change = Instant::now();
            }
        }
    }

    /// Force-transition to Closed (operator override / health reset).
    pub fn force_close(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.state = CircuitState::Closed;
        inner.failure_count = 0;
        inner.success_count = 0;
        inner.last_state_change = Instant::now();
    }
}

// ---------------------------------------------------------------------------
// CircuitRegistry — per-upstream breaker store
// ---------------------------------------------------------------------------

/// Per-upstream registry. Used by the router to look up the breaker for a
/// given target string. Stage-2 inserts upstream keys via `cfg`.
#[derive(Clone, Debug)]
pub struct CircuitRegistry {
    config: CircuitBreakerConfig,
    breakers: Arc<Mutex<HashMap<String, Arc<CircuitBreaker>>>>,
}

impl CircuitRegistry {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            breakers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get or create a breaker for the given upstream target.
    pub fn for_target(&self, target: &str) -> Arc<CircuitBreaker> {
        let mut map = self.breakers.lock().unwrap();
        map.entry(target.to_string())
            .or_insert_with(|| Arc::new(CircuitBreaker::new(target, self.config)))
            .clone()
    }

    /// Snapshot every breaker's current state — used by the Prometheus
    /// exporter.
    pub fn snapshot(&self) -> Vec<(String, CircuitState)> {
        let map = self.breakers.lock().unwrap();
        map.iter()
            .map(|(name, cb)| (name.clone(), cb.state()))
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Middleware wiring
// ---------------------------------------------------------------------------

/// Shared state for the middleware: the registry + the upstream key the
/// current route is configured to guard. Stage 2 routes all traffic through
/// one global breaker (the `default` upstream). Stage 3 will thread the real
/// upstream name from the dynamic router.
#[derive(Clone, Debug)]
pub struct CircuitBreakerState {
    pub registry: Arc<CircuitRegistry>,
    pub default_target: Arc<String>,
}

impl CircuitBreakerState {
    pub fn new(config: CircuitBreakerConfig, default_target: impl Into<String>) -> Self {
        Self {
            registry: Arc::new(CircuitRegistry::new(config)),
            default_target: Arc::new(default_target.into()),
        }
    }
}

#[derive(Debug, Serialize)]
struct OpenResponse {
    error: &'static str,
    message: &'static str,
    target: String,
}

pub async fn middleware(
    State(state): State<CircuitBreakerState>,
    req: Request,
    next: Next,
) -> Response {
    let target = state.default_target.clone();
    let breaker = state.registry.for_target(&target);
    if !breaker.allow() {
        warn!(
            target = %*target,
            "circuit breaker rejected request"
        );
        let body = OpenResponse {
            error: "service temporarily unavailable",
            message: "circuit breaker is open",
            target: target.to_string(),
        };
        return (StatusCode::SERVICE_UNAVAILABLE, axum::Json(body)).into_response();
    }

    let response = next.run(req).await;

    // Treat 5xx as failure; everything else (4xx, 2xx, 3xx) as success.
    let status = response.status();
    if status.is_server_error() {
        breaker.record_failure();
    } else {
        breaker.record_success();
    }
    response
}

// Re-export the body type so downstream `axum::body::to_bytes` tests can stay
// type-agnostic across refactors.
#[allow(dead_code)]
pub(crate) type ResponseBody = Body;