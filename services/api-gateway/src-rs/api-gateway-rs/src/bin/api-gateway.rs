//! `api-gateway` binary — main entry point.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/cmd/gateway/main.go`.
//! Listens on port 8080 by default; override via `API_GATEWAY_PORT` env var.

use std::net::SocketAddr;
use std::time::Duration;

use api_gateway_rs::{build_router, AppState};
use tokio::net::TcpListener;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();

    let state = AppState::from_env();
    let app = build_router(state.clone());

    let port: u16 = std::env::var("API_GATEWAY_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    info!(
        service = %state.service_name,
        listen_addr = %addr,
        "starting Axi API Gateway (rust migration target, stage 1 scaffold)"
    );

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,api_gateway_rs=debug"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .json()
        .with_current_span(true)
        .with_span_list(false)
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            sig.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("received SIGINT, draining gateway"),
        _ = terminate => info!("received SIGTERM, draining gateway"),
    }

    // Tiny grace period to flush traces / logs.
    tokio::time::sleep(Duration::from_millis(200)).await;
}

/// Helper used by integration tests.
pub async fn run_for_tests() -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState::from_env();
    let app = build_router(state);
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    info!("api-gateway test instance bound");
    if let Err(err) = axum::serve(listener, app).await {
        error!(error = %err, "test server exited with error");
    }
    Ok(())
}