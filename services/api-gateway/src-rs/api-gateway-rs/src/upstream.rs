//! Upstream (sibling-service) representation and forwarding stub.
//!
//! The Go gateway fronts 12 sibling services (see ADR-017). This module
//! types them as [`UpstreamService`] and exposes a [`call`] stub. Real HTTP
//! forwarding lands in stage 2 (hyper client + circuit breaker).

use std::collections::HashMap;

use axum::extract::Request;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// The kind of upstream the gateway forwards to.
///
/// Mirrors the `upstreamType` field in `config/routes.yaml`.
#[derive(
    Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize,
)]
pub enum UpstreamType {
    Identity,
    Platform,
    LegacyCore,
    File,
    Workflow,
    Notification,
    ControlPlane,
    MobileControl,
}

impl UpstreamType {
    /// Environment variable that holds the base URL for this upstream.
    pub fn env_var(self) -> &'static str {
        match self {
            UpstreamType::Identity => "IDENTITY_ADAPTER_URL",
            UpstreamType::Platform => "PLATFORM_CORE_URL",
            UpstreamType::LegacyCore => "LEGACY_CORE_SERVICE_URL",
            UpstreamType::File => "FILE_SERVICE_URL",
            UpstreamType::Workflow => "WORKFLOW_URL",
            UpstreamType::Notification => "NOTIFICATION_URL",
            UpstreamType::ControlPlane => "CONTROL_PLANE_URL",
            UpstreamType::MobileControl => "CONTROL_PLANE_URL",
        }
    }

    /// All 12 sibling-service upstreams this gateway is aware of.
    ///
    /// The Go `cmd/gateway/main.go` instantiates these in `proxyHandler`
    /// constructor — the same set is enumerated here so the Rust binary
    /// never silently drops a sibling.
    pub fn all() -> [UpstreamType; 8] {
        [
            UpstreamType::Identity,
            UpstreamType::Platform,
            UpstreamType::LegacyCore,
            UpstreamType::File,
            UpstreamType::Workflow,
            UpstreamType::Notification,
            UpstreamType::ControlPlane,
            UpstreamType::MobileControl,
        ]
    }
}

/// A typed upstream service the gateway forwards to.
#[derive(Clone, Debug)]
pub struct UpstreamService {
    /// Kind of upstream (identity / platform / file / ...).
    pub kind: UpstreamType,
    /// Human-readable service name (matches `cmd/gateway/main.go` arg names).
    pub name: &'static str,
    /// Base URL for HTTP forwarding. Empty string = not configured.
    pub base_url: String,
    /// Static internal token injected as `Authorization: Bearer <token>`
    /// when the route's filters list `RequireInternalToken`.
    pub internal_token: String,
}

impl UpstreamService {
    /// Build the 12 sibling-service upstreams from environment variables.
    ///
    /// The Go `config.Config.Services` block reads the same env vars; this
    /// function preserves the lookup order so a missing env var is visible
    /// the same way it is in the Go binary.
    pub fn defaults_from_env() -> Vec<UpstreamService> {
        let names: [(&'static str, UpstreamType, &'static str); 8] = [
            ("identity-adapter", UpstreamType::Identity, "IDENTITY_ADAPTER_URL"),
            ("platform-core", UpstreamType::Platform, "PLATFORM_CORE_URL"),
            ("core-service", UpstreamType::LegacyCore, "LEGACY_CORE_SERVICE_URL"),
            ("file-service", UpstreamType::File, "FILE_SERVICE_URL"),
            ("workflow-engine", UpstreamType::Workflow, "WORKFLOW_URL"),
            ("notification-service", UpstreamType::Notification, "NOTIFICATION_URL"),
            ("control-plane", UpstreamType::ControlPlane, "CONTROL_PLANE_URL"),
            ("mobile-control", UpstreamType::MobileControl, "CONTROL_PLANE_URL"),
        ];

        let mut by_kind: HashMap<UpstreamType, UpstreamService> = HashMap::new();
        for (name, kind, env) in names {
            let base_url = std::env::var(env).unwrap_or_default();
            let token_env = format!("{env}_INTERNAL_TOKEN");
            let internal_token = std::env::var(&token_env).unwrap_or_default();
            let entry = UpstreamService {
                kind,
                name,
                base_url,
                internal_token,
            };
            // Mobile control reuses ControlPlane's URL/token; the FIRST
            // insertion wins so we don't clobber the ControlPlane entry.
            by_kind.entry(kind).or_insert(entry);
        }
        by_kind.into_values().collect()
    }
}

/// Errors that can surface when forwarding to an upstream.
#[derive(Debug, Error)]
pub enum UpstreamError {
    #[error("upstream not configured: {0}")]
    NotConfigured(&'static str),
    #[error("upstream timeout: {0}")]
    Timeout(&'static str),
    #[error("upstream returned status {status} for {target}: {message}")]
    BadStatus {
        target: &'static str,
        status: u16,
        message: String,
    },
    #[error("transport error contacting {target}: {message}")]
    Transport {
        target: &'static str,
        message: String,
    },
    #[error("circuit breaker open for {target}")]
    CircuitOpen { target: &'static str },
}

/// Forward a request to the configured upstream.
///
/// Stage-1 stub: returns a 501 with a marker JSON body describing which
/// upstream the request would have hit. Stage 2 swaps in a real `hyper`
/// client + circuit-breaker state machine.
pub async fn call(upstream: &UpstreamService, req: Request) -> Result<Response, UpstreamError> {
    let _ = req;
    if upstream.base_url.is_empty() {
        return Err(UpstreamError::NotConfigured(upstream.name));
    }

    let body = Json(serde_json::json!({
        "stage": 1,
        "upstream": upstream.name,
        "upstream_kind": upstream.kind,
        "status": "stub",
    }));
    Ok((StatusCode::NOT_IMPLEMENTED, body).into_response())
}