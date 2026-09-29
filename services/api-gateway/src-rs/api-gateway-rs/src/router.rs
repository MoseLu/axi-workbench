//! Router construction.
//!
//! The full routing table lives in
//! `workbench/axi-workbench/services/api-gateway/config/routes.yaml`. This
//! module mirrors that table 1:1. The Rust migration MUST NOT diverge: the
//! 12-sibling-service contract is the load-bearing piece of ADR-017.
//!
//! In stage 2 the YAML loader will be added back; in stage 1 the table is
//! hard-coded so reviewers can diff the table against `routes.yaml`.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::Extension;
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::middleware;
use crate::upstream::{UpstreamService, UpstreamType};

/// Shared application state injected into every handler.
#[derive(Clone, Debug)]
pub struct AppState {
    /// The 12 sibling-service upstreams this gateway forwards to.
    pub upstreams: Arc<HashMap<UpstreamType, UpstreamService>>,
    /// Logical service name surfaced in tracing spans and Prometheus labels.
    pub service_name: Arc<String>,
}

impl AppState {
    /// Construct the default app state with the 12 sibling upstreams wired up
    /// from environment variables (matching the Go `config.Config.Services`
    /// contract).
    pub fn from_env() -> Self {
        let mut upstreams = HashMap::new();
        // The list mirrors cmd/gateway/main.go `proxyHandler` constructor.
        for upstream in UpstreamService::defaults_from_env() {
            upstreams.insert(upstream.kind, upstream);
        }
        Self {
            upstreams: Arc::new(upstreams),
            service_name: Arc::new("axi-api-gateway".to_string()),
        }
    }
}

/// Build the gateway router with the standard middleware chain.
///
/// The chain order matches `setupRouter` in
/// `workbench/axi-workbench/services/api-gateway/cmd/gateway/main.go`:
///
/// 1. `RequestID`     → `tower-http::request_id::SetRequestIdLayer`
/// 2. `TraceContext`  → custom W3C traceparent layer
/// 3. `Tracing`       → `tracing::Span` rooted at service name
/// 4. `Logging`       → `tracing::info!` on request/response
/// 5. `Cors`          → `tower-http::cors::CorsLayer`
/// 6. `RateLimit`     → `governor::RateLimiter` (stubbed in stage 1)
/// 7. (route-level) `CircuitBreaker`, `RequireIdentity`, `Audit`
///
/// Any reordering of this chain requires a new ADR per ADR-017.
pub fn build_router(state: AppState) -> Router {
    // --- Stage 1 stub: middleware layers are placeholders that delegate to
    // their respective `middleware::*::middleware` stubs. Real tower layers
    // land in stage 2.
    let request_id = middleware::request_id::layer();
    let trace_context = middleware::tracing::layer();
    let logging = middleware::logging::layer();
    let cors = middleware::cors::layer();
    let rate_limit = middleware::rate_limit::default_layer();

    let api = Router::new()
        // Health (no auth)
        .route("/health", get(health))
        .route("/ready", get(ready))
        // Auth / sessions
        .route("/api/v1/auth/session", get(session))
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/auth/oidc/start", get(oidc_start))
        .route("/api/v1/auth/oidc/callback", get(oidc_callback))
        .route("/api/v1/auth/methods", get(auth_methods))
        .route("/api/v1/auth/email-verifications", post(email_verifications))
        .route("/api/v1/auth/device-login/qr", post(device_login_qr_create))
        .route(
            "/api/v1/auth/device-login/qr/{id}",
            get(device_login_qr_status),
        )
        .route(
            "/api/v1/auth/device-login/qr/{id}/consume",
            post(device_login_qr_consume),
        )
        // Sessions
        .route("/api/v1/sessions", post(sessions_create))
        .route("/api/v1/sessions/current", get(session_current))
        .route("/api/v1/sessions/resume", get(session_resume))
        .route("/api/v1/sessions/email", post(sessions_email))
        // Users / profile
        .route("/api/v1/users/me", get(users_me))
        .route(
            "/api/v1/users/me/profile",
            get(users_me_profile).patch(users_me_profile),
        )
        // Tenants
        .route("/api/v1/tenants", get(tenants_list).post(tenants_create))
        .route(
            "/api/v1/tenants/{tenant_id}/members",
            get(tenant_members).put(tenant_members),
        )
        .route(
            "/api/v1/tenants/{tenant_id}/dictionaries/{key}",
            get(tenant_dictionary).put(tenant_dictionary),
        )
        .route(
            "/api/v1/me/preferences",
            get(me_preferences).patch(me_preferences),
        )
        // Files
        .route("/api/v1/files/{*path}", get(files_proxy))
        // Workflows
        .route(
            "/api/v1/workflows",
            get(workflows_list).post(workflows_create),
        )
        .route(
            "/api/v1/workflows/{id}",
            get(workflow_get)
                .patch(workflow_update)
                .put(workflow_update)
                .delete(workflow_delete),
        )
        .route(
            "/api/v1/workflows/{id}/execute",
            post(workflow_execute),
        )
        // Notifications
        .route(
            "/api/v1/notifications",
            get(notifications_list).post(notifications_create),
        )
        // Control plane (web)
        .route("/api/v1/control-plane/{*path}", get(control_plane_proxy))
        // Mobile control plane
        .route("/api/v1/mobile/pair/{*path}", any(mobile_proxy))
        .route("/api/v1/mobile/auth/{*path}", post(mobile_proxy))
        .route("/api/v1/mobile/workspace/{*path}", get(mobile_proxy))
        .route("/api/v1/mobile/handoffs/{*path}", get(mobile_proxy))
        .route("/api/v1/mobile/jobs/{*path}", post(mobile_proxy))
        .route(
            "/api/v1/mobile/approvals/{id}/decision/{*path}",
            post(mobile_proxy),
        )
        // Commit ledger
        .route("/api/v1/commit-ledger/summary", get(commit_ledger_proxy))
        .route("/api/v1/commit-ledger/commits", get(commit_ledger_proxy))
        .route("/api/v1/commit-ledger/commits/{*path}", get(commit_ledger_proxy))
        .route(
            "/api/v1/commit-ledger/projects/{*path}",
            get(commit_ledger_proxy),
        )
        .route(
            "/api/v1/commit-ledger/verification",
            get(commit_ledger_proxy),
        )
        .route("/api/v1/commit-ledger/sources", get(commit_ledger_proxy))
        .route("/api/v1/commit-ledger/sync", post(commit_ledger_proxy))
        // Email login confirmation
        .route("/api/v1/auth/login/email/confirm", post(email_login_confirm))
        // Internal routes
        .route("/api/v1/internal/events", post(internal_events))
        .route(
            "/api/v1/internal/zitadel/qr/transactions/{id}/complete",
            post(internal_zitadel_qr),
        )
        // Admin routes (dynamic router REST surface)
        .nest("/api/v1/admin", admin_routes());

    Router::new()
        .merge(api)
        .layer(axum::Extension(state.clone()))
        // Outer middleware chain — order matters.
        .layer(request_id)
        .layer(trace_context)
        .layer(logging)
        .layer(cors)
        .layer(rate_limit)
        .layer(axum::Extension(state))
}

fn admin_routes() -> Router {
    Router::new()
        .route("/routes", get(admin_list_routes).post(admin_add_route))
        .route(
            "/routes/{id}",
            get(admin_get_route)
                .put(admin_update_route)
                .delete(admin_delete_route),
        )
        .route("/routes/reload", post(admin_reload_routes))
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

async fn health() -> Response {
    (StatusCode::OK, Json(serde_json::json!({"status": "ok"}))).into_response()
}

async fn ready(Extension(state): Extension<AppState>) -> Response {
    let mut upstreams_ok = 0;
    for upstream in state.upstreams.values() {
        if !upstream.base_url.is_empty() {
            upstreams_ok += 1;
        }
    }
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "ready",
            "service": *state.service_name,
            "upstreams_configured": upstreams_ok,
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Stub handlers — every protected route resolves to `forbidden_hello` until
// stage 2 wires real proxy + identity logic.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
struct StubResponse {
    route: String,
    status: &'static str,
}

async fn session() -> Response {
    Json(StubResponse {
        route: "session".into(),
        status: "ok",
    })
    .into_response()
}
async fn logout() -> Response {
    Json(StubResponse {
        route: "logout".into(),
        status: "ok",
    })
    .into_response()
}
async fn oidc_start() -> Response {
    Json(StubResponse {
        route: "oidc-start".into(),
        status: "ok",
    })
    .into_response()
}
async fn oidc_callback() -> Response {
    Json(StubResponse {
        route: "oidc-callback".into(),
        status: "ok",
    })
    .into_response()
}
async fn auth_methods() -> Response {
    Json(StubResponse {
        route: "auth-methods".into(),
        status: "ok",
    })
    .into_response()
}
async fn email_verifications() -> Response {
    Json(StubResponse {
        route: "email-verifications".into(),
        status: "ok",
    })
    .into_response()
}
async fn device_login_qr_create() -> Response {
    Json(StubResponse {
        route: "device-login-qr-create".into(),
        status: "ok",
    })
    .into_response()
}
async fn device_login_qr_status() -> Response {
    Json(StubResponse {
        route: "device-login-qr-status".into(),
        status: "ok",
    })
    .into_response()
}
async fn device_login_qr_consume() -> Response {
    Json(StubResponse {
        route: "device-login-qr-consume".into(),
        status: "ok",
    })
    .into_response()
}
async fn sessions_create() -> Response {
    Json(StubResponse {
        route: "sessions-create".into(),
        status: "ok",
    })
    .into_response()
}
async fn session_current() -> Response {
    Json(StubResponse {
        route: "session-current".into(),
        status: "ok",
    })
    .into_response()
}
async fn session_resume() -> Response {
    Json(StubResponse {
        route: "session-resume".into(),
        status: "ok",
    })
    .into_response()
}
async fn sessions_email() -> Response {
    Json(StubResponse {
        route: "sessions-email".into(),
        status: "ok",
    })
    .into_response()
}
async fn users_me() -> Response {
    Json(StubResponse {
        route: "users-me".into(),
        status: "ok",
    })
    .into_response()
}
async fn users_me_profile() -> Response {
    Json(StubResponse {
        route: "users-me-profile".into(),
        status: "ok",
    })
    .into_response()
}
async fn tenants_list() -> Response {
    Json(StubResponse {
        route: "tenants-list".into(),
        status: "ok",
    })
    .into_response()
}
async fn tenants_create() -> Response {
    Json(StubResponse {
        route: "tenants-create".into(),
        status: "ok",
    })
    .into_response()
}
async fn tenant_members() -> Response {
    Json(StubResponse {
        route: "tenant-members".into(),
        status: "ok",
    })
    .into_response()
}
async fn tenant_dictionary() -> Response {
    Json(StubResponse {
        route: "tenant-dictionary".into(),
        status: "ok",
    })
    .into_response()
}
async fn me_preferences() -> Response {
    Json(StubResponse {
        route: "me-preferences".into(),
        status: "ok",
    })
    .into_response()
}
async fn files_proxy() -> Response {
    Json(StubResponse {
        route: "files-proxy".into(),
        status: "ok",
    })
    .into_response()
}
async fn workflows_list() -> Response {
    Json(StubResponse {
        route: "workflows-list".into(),
        status: "ok",
    })
    .into_response()
}
async fn workflows_create() -> Response {
    Json(StubResponse {
        route: "workflows-create".into(),
        status: "ok",
    })
    .into_response()
}
async fn workflow_get() -> Response {
    Json(StubResponse {
        route: "workflow-get".into(),
        status: "ok",
    })
    .into_response()
}
async fn workflow_update() -> Response {
    Json(StubResponse {
        route: "workflow-update".into(),
        status: "ok",
    })
    .into_response()
}
async fn workflow_delete() -> Response {
    Json(StubResponse {
        route: "workflow-delete".into(),
        status: "ok",
    })
    .into_response()
}
async fn workflow_execute() -> Response {
    Json(StubResponse {
        route: "workflow-execute".into(),
        status: "ok",
    })
    .into_response()
}
async fn notifications_list() -> Response {
    Json(StubResponse {
        route: "notifications-list".into(),
        status: "ok",
    })
    .into_response()
}
async fn notifications_create() -> Response {
    Json(StubResponse {
        route: "notifications-create".into(),
        status: "ok",
    })
    .into_response()
}
async fn control_plane_proxy(method: Method) -> Response {
    Json(StubResponse {
        route: format!("control-plane-proxy:{}", method),
        status: "ok",
    })
    .into_response()
}
async fn mobile_proxy(method: Method) -> Response {
    Json(StubResponse {
        route: format!("mobile-proxy:{}", method),
        status: "ok",
    })
    .into_response()
}
async fn commit_ledger_proxy() -> Response {
    Json(StubResponse {
        route: "commit-ledger-proxy".into(),
        status: "ok",
    })
    .into_response()
}
async fn email_login_confirm() -> Response {
    Json(StubResponse {
        route: "email-login-confirm".into(),
        status: "ok",
    })
    .into_response()
}
async fn internal_events() -> Response {
    Json(StubResponse {
        route: "internal-events".into(),
        status: "ok",
    })
    .into_response()
}
async fn internal_zitadel_qr() -> Response {
    Json(StubResponse {
        route: "internal-zitadel-qr".into(),
        status: "ok",
    })
    .into_response()
}

// ---------------------------------------------------------------------------
// Admin handlers (dynamic router surface)
// ---------------------------------------------------------------------------

async fn admin_list_routes() -> Response {
    Json(serde_json::json!({"routes": []})).into_response()
}
async fn admin_get_route() -> Response {
    (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "not found"})))
        .into_response()
}
async fn admin_add_route() -> Response {
    (StatusCode::NOT_IMPLEMENTED, Json(serde_json::json!({"error": "stub"})))
        .into_response()
}
async fn admin_update_route() -> Response {
    (StatusCode::NOT_IMPLEMENTED, Json(serde_json::json!({"error": "stub"})))
        .into_response()
}
async fn admin_delete_route() -> Response {
    (StatusCode::NOT_IMPLEMENTED, Json(serde_json::json!({"error": "stub"})))
        .into_response()
}
async fn admin_reload_routes() -> Response {
    (StatusCode::NOT_IMPLEMENTED, Json(serde_json::json!({"error": "stub"})))
        .into_response()
}