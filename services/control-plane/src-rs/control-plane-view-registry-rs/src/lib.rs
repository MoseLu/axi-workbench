//! `control-plane-view-registry-rs`
//!
//! View and snapshot registry for the Axi Workstation control plane.
//!
//! Stage 4 of the migration described in
//! `docs/adr/ADR-018-control-plane-rust-split.md`. This crate replaces the
//! snapshot / Personal OS / pairing projections that today live in
//! `src/control-plane.mjs`, `src/personal-os.mjs` and `src/pairing.mjs`.
//! A [`View`] is a typed JSON schema + kind pair; the registry returns the
//! schema by id and the server crate builds a JSON projection by
//! deserializing events from `control-plane-event-store-rs` into that
//! schema.
//!
//! Today the crate is a skeleton: the public types and trait exist and an
//! in-memory implementation is wired so the library is `cargo check`-able.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;

/// A typed projection. `kind` is the projection family
/// (`"governance_snapshot"`, `"personal_os"`, `"pairing"`); `schema` is a
/// `serde_json::Value` shape that the server validates responses against.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct View {
    pub id: String,
    pub kind: String,
    pub schema: serde_json::Value,
}

/// Errors produced by a [`ViewRegistry`] implementation.
#[derive(Debug, Error)]
pub enum RegistryError {
    #[error("view with id {id} is already registered")]
    Duplicate { id: String },
    #[error("view with id {id} not found")]
    NotFound { id: String },
    #[error("view schema is invalid: {0}")]
    InvalidSchema(String),
}

/// The contract every view registry must satisfy.
///
/// `register` is `&mut self` because the typical implementation maintains
/// an in-memory map; `resolve` is read-only. The trait is `Send + Sync` so
/// the aggregator can clone an `Arc<dyn ViewRegistry>` across tasks.
#[async_trait]
pub trait ViewRegistry: Send + Sync {
    async fn register(&mut self, view: View) -> Result<(), RegistryError>;

    async fn resolve(&self, id: &str) -> Result<Option<View>, RegistryError>;

    async fn list(&self) -> Result<Vec<View>, RegistryError>;
}

/// In-memory implementation used until stage 4 lands the persistence path.
#[derive(Debug, Default)]
pub struct InMemoryViewRegistry {
    views: Arc<RwLock<HashMap<String, View>>>,
}

impl InMemoryViewRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl ViewRegistry for InMemoryViewRegistry {
    async fn register(&mut self, view: View) -> Result<(), RegistryError> {
        let mut guard = self.views.write().await;
        if guard.contains_key(&view.id) {
            return Err(RegistryError::Duplicate { id: view.id });
        }
        guard.insert(view.id.clone(), view);
        Ok(())
    }

    async fn resolve(&self, id: &str) -> Result<Option<View>, RegistryError> {
        let guard = self.views.read().await;
        Ok(guard.get(id).cloned())
    }

    async fn list(&self) -> Result<Vec<View>, RegistryError> {
        let guard = self.views.read().await;
        Ok(guard.values().cloned().collect())
    }
}

/// Construct a `governance_snapshot` view stub. The full projection lands
/// in stage 4; today this returns a stable shape that the server can return
/// without panicking when `/snapshot` is called.
pub fn governance_snapshot_view() -> View {
    View {
        id: "governance.snapshot.v1".into(),
        kind: "governance_snapshot".into(),
        schema: serde_json::json!({
            "type": "object",
            "properties": {
                "governance": { "type": "object" },
                "relationships": { "type": "array" },
                "impact": { "type": "array" },
            },
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn register_then_resolve() {
        let mut registry = InMemoryViewRegistry::new();
        let view = View {
            id: "v1".into(),
            kind: "test".into(),
            schema: json!({}),
        };
        registry.register(view.clone()).await.unwrap();
        let resolved = registry.resolve("v1").await.unwrap();
        assert_eq!(resolved, Some(view));
    }

    #[tokio::test]
    async fn register_rejects_duplicate() {
        let mut registry = InMemoryViewRegistry::new();
        let view = View {
            id: "v1".into(),
            kind: "test".into(),
            schema: json!({}),
        };
        registry.register(view.clone()).await.unwrap();
        let err = registry.register(view).await.unwrap_err();
        assert!(matches!(err, RegistryError::Duplicate { .. }));
    }

    #[test]
    fn governance_snapshot_view_is_stable() {
        let view = governance_snapshot_view();
        assert_eq!(view.kind, "governance_snapshot");
        assert_eq!(view.id, "governance.snapshot.v1");
    }
}