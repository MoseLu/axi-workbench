//! Prometheus metrics module — `/metrics` endpoint + typed counters.
//!
//! Mirrors the Go `axi_api_gateway_*` metric set declared in
//! `workbench/axi-workbench/services/api-gateway/observability/prom.go`:
//! - `axi_api_gateway_requests_total{path,method,status}` — request counter
//! - `axi_api_gateway_request_duration_seconds{path,method}` — request histogram
//! - `axi_api_gateway_circuit_state{upstream}` — current circuit breaker state
//! - `axi_api_gateway_rate_limit_decisions_total{outcome}` — `ok` / `limited`
//!
//! The metric names are deliberately identical to the Go binary so the
//! existing Grafana dashboards keep working unchanged.

use std::sync::Arc;

use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use prometheus::{
    Encoder, HistogramOpts, HistogramVec, IntCounterVec, IntGaugeVec, Opts, Registry, TextEncoder,
};

/// Holder for the live Prometheus [`Registry`] plus the typed metric vectors.
/// All counters are registered at construction so they appear in `/metrics`
/// from the first scrape, even before any traffic flows.
#[derive(Clone)]
pub struct Metrics {
    pub registry: Arc<Registry>,
    pub requests_total: IntCounterVec,
    pub request_duration_seconds: HistogramVec,
    pub circuit_state: IntGaugeVec,
    pub rate_limit_decisions: IntCounterVec,
    pub upstreams_configured: prometheus::IntGauge,
}

impl std::fmt::Debug for Metrics {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Metrics")
            .field("registry", &self.registry)
            .finish()
    }
}

impl Metrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        let requests_total = IntCounterVec::new(
            Opts::new(
                "axi_api_gateway_requests_total",
                "Total number of HTTP requests handled by the Axi API gateway",
            ),
            &["path", "method", "status"],
        )
        .expect("counter vec construction");
        let request_duration_seconds = HistogramVec::new(
            HistogramOpts::new(
                "axi_api_gateway_request_duration_seconds",
                "Request handler latency in seconds",
            )
            .buckets(vec![
                0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
            ]),
            &["path", "method"],
        )
        .expect("histogram vec construction");
        let circuit_state = IntGaugeVec::new(
            Opts::new(
                "axi_api_gateway_circuit_state",
                "Current circuit breaker state per upstream (0=closed, 1=open, 2=half_open)",
            ),
            &["upstream"],
        )
        .expect("gauge vec construction");
        let rate_limit_decisions = IntCounterVec::new(
            Opts::new(
                "axi_api_gateway_rate_limit_decisions_total",
                "Rate limit decisions emitted by the governor-backed limiter",
            ),
            &["outcome"],
        )
        .expect("counter vec construction");
        let upstreams_configured = prometheus::IntGauge::new(
            "axi_api_gateway_upstreams_configured",
            "Number of upstreams with a non-empty base URL at startup",
        )
        .expect("gauge construction");
        registry.register(Box::new(requests_total.clone())).expect("register requests_total");
        registry
            .register(Box::new(request_duration_seconds.clone()))
            .expect("register request_duration_seconds");
        registry.register(Box::new(circuit_state.clone())).expect("register circuit_state");
        registry
            .register(Box::new(rate_limit_decisions.clone()))
            .expect("register rate_limit_decisions");
        registry
            .register(Box::new(upstreams_configured.clone()))
            .expect("register upstreams_configured");

        // Pre-register the "ok" and "limited" labels so the first scrape
        // surfaces both series even before any traffic flows.
        rate_limit_decisions.with_label_values(&["ok"]).reset();
        rate_limit_decisions.with_label_values(&["limited"]).reset();

        Self {
            registry: Arc::new(registry),
            requests_total,
            request_duration_seconds,
            circuit_state,
            rate_limit_decisions,
            upstreams_configured,
        }
    }

    /// Encode the live metric snapshot into Prometheus text-format bytes.
    pub fn encode(&self) -> Result<Vec<u8>, prometheus::Error> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::with_capacity(8 * 1024);
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(buffer)
    }

    /// Convenience: record one served request.
    pub fn record_request(&self, path: &str, method: &str, status: u16, elapsed_secs: f64) {
        self.requests_total
            .with_label_values(&[path, method, &status.to_string()])
            .inc();
        self.request_duration_seconds
            .with_label_values(&[path, method])
            .observe(elapsed_secs);
    }

    /// Convenience: record a rate-limit decision.
    pub fn record_rate_limit(&self, outcome: &str) {
        self.rate_limit_decisions.with_label_values(&[outcome]).inc();
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

/// `/metrics` axum handler. Returns 200 + Prometheus text format.
pub async fn metrics_handler(State(metrics): State<Arc<Metrics>>) -> Response {
    match metrics.encode() {
        Ok(buffer) => (
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                "text/plain; version=0.0.4; charset=utf-8",
            )],
            buffer,
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("metrics encode failed: {err}"),
        )
            .into_response(),
    }
}

/// Build the metrics router. Mount under `/metrics`.
pub fn metrics_router(metrics: Arc<Metrics>) -> Router {
    Router::new()
        .route("/metrics", get(metrics_handler))
        .with_state(metrics)
}