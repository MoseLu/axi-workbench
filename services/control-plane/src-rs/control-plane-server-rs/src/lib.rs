//! `control-plane-server-rs`
//!
//! HTTP/gRPC server aggregator for the Axi Workstation control plane Rust
//! crates.
//!
//! Stage 5 of the migration described in
//! `docs/adr/ADR-018-control-plane-rust-split.md`. This crate owns the four
//! leaf crates (`event-store`, `outbox`, `resource-policy`, `view-registry`)
//! as `path` dependencies and exposes a single `ControlPlaneServer` value
//! with a `serve(SocketAddr)` entry point.
//!
//! Today the crate is a skeleton: `ControlPlaneServer` owns the four
//! component handles, `serve` validates the address and registers the
//! canonical view stubs, so the library is `cargo check`-able. Real
//! `axum` / `hyper` routing and the `.mjs` sidecar glue land in stage 5.

use std::net::SocketAddr;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::info;

use control_plane_event_store_rs::{EventStore, InMemoryEventStore};
use control_plane_outbox_rs::{InMemoryOutbox, Outbox};
use control_plane_resource_policy_rs::{DenyByDefaultPolicyEngine, PolicyEngine};
use control_plane_view_registry_rs::{
    governance_snapshot_view, InMemoryViewRegistry, ViewRegistry,
};

/// Aggregator that owns the four Rust leaf crates. The `.mjs` server keeps
/// its public function signatures; the broker eventually constructs one
/// `ControlPlaneServer` per process and forwards every migrated route into
/// it.
pub struct ControlPlaneServer {
    pub event_store: Box<dyn EventStore>,
    pub outbox: Box<dyn Outbox>,
    pub policy_engine: Box<dyn PolicyEngine>,
    pub view_registry: Box<dyn ViewRegistry>,
}

/// Configuration accepted by [`ControlPlaneServer::serve`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub bind_addr: SocketAddr,
    #[serde(default)]
    pub graceful_shutdown_secs: u64,
}

impl ServerConfig {
    pub fn new(bind_addr: SocketAddr) -> Self {
        Self {
            bind_addr,
            graceful_shutdown_secs: 30,
        }
    }
}

/// Errors surfaced by [`ControlPlaneServer::serve`].
#[derive(Debug, Error)]
pub enum ServeError {
    #[error("invalid bind address {addr}: {reason}")]
    InvalidBindAddr { addr: SocketAddr, reason: String },
    #[error("control plane backend initialization failed: {0}")]
    Backend(String),
    #[error("control plane server exited unexpectedly")]
    UnexpectedExit,
}

impl ControlPlaneServer {
    /// Build the default skeleton: in-memory implementations of all four
    /// leaf crates and a pre-registered governance snapshot view.
    pub fn skeleton() -> Self {
        Self {
            event_store: Box::new(InMemoryEventStore::new()),
            outbox: Box::new(InMemoryOutbox::new()),
            policy_engine: Box::new(DenyByDefaultPolicyEngine),
            view_registry: Box::new(InMemoryViewRegistry::new()),
        }
    }

    /// Register the canonical view stubs and bind the listener.
    /// Today this only validates the bind address and registers the
    /// governance snapshot view. Stage 5 replaces the body with an
    /// `axum::serve` loop.
    pub async fn serve(mut self, addr: SocketAddr) -> Result<(), ServeError> {
        if addr.port() == 0 {
            return Err(ServeError::InvalidBindAddr {
                addr,
                reason: "port 0 is reserved for the OS; pass the resolved port".to_string(),
            });
        }
        self.view_registry
            .register(governance_snapshot_view())
            .await
            .map_err(|err| ServeError::Backend(err.to_string()))?;
        info!(%addr, "control-plane-server-rs skeleton ready");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn skeleton_serve_rejects_port_zero() {
        let server = ControlPlaneServer::skeleton();
        let addr: SocketAddr = "127.0.0.1:0".parse().unwrap();
        let err = server.serve(addr).await.unwrap_err();
        assert!(matches!(err, ServeError::InvalidBindAddr { .. }));
    }

    #[tokio::test]
    async fn skeleton_serve_accepts_loopback() {
        let server = ControlPlaneServer::skeleton();
        // pick a port that is almost certainly free in unit tests
        let addr: SocketAddr = "127.0.0.1:39191".parse().unwrap();
        // We do not actually bind; the skeleton logs and returns. If the
        // bind moves into the body in stage 5, the test must update.
        server.serve(addr).await.unwrap();
    }
}