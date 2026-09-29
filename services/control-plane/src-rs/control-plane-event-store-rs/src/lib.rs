//! `control-plane-event-store-rs`
//!
//! Append-only Workspace Event store for the Axi Workstation control plane.
//! This crate is the leaf of the Rust migration described in
//! `docs/adr/ADR-018-control-plane-rust-split.md`; it owns the typed
//! `Event` contract and the [`EventStore`] trait that the broker,
//! outbox replay, view registry and policy engine all read from.
//!
//! Today the crate is a skeleton: the public types and trait exist and an
//! in-memory implementation is wired so the library is `cargo check`-able.
//! Real persistence, JSONL append, and the `/events` pagination semantics
//! land in stage 1 of the migration plan.

use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Schema version pinned by the `.mjs` consumer until that consumer migrates.
/// Cross-language conformance tests will assert that every Workspace Event
/// written from Rust carries this version.
pub const SCHEMA_VERSION: &str = "control-plane-event.v1";

/// A typed Workspace Event.
///
/// `payload` is intentionally `serde_json::Value` so the broker can attach
/// RBAC grant references, correlation ids and result envelopes without the
/// store needing to know their shapes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Event {
    pub id: Uuid,
    pub topic: String,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    #[serde(default = "default_schema_version")]
    pub schema_version: String,
}

fn default_schema_version() -> String {
    SCHEMA_VERSION.to_string()
}

/// Errors produced by an [`EventStore`] implementation. Surface this to the
/// `.mjs` server as a structured 4xx/5xx response without leaking the
/// underlying cause beyond the `source` chain.
#[derive(Debug, Error)]
pub enum StoreError {
    #[error("event payload is not valid JSON for topic {topic}")]
    InvalidPayload { topic: String },
    #[error("event with id {id} not found")]
    NotFound { id: Uuid },
    #[error("event store backend is unavailable: {0}")]
    BackendUnavailable(String),
}

/// The contract every event store implementation must satisfy.
///
/// The trait is `Send + Sync` so it can live behind an `Arc<dyn EventStore>`
/// inside the aggregating `control-plane-server` crate.
#[async_trait]
pub trait EventStore: Send + Sync {
    /// Append an event. Implementations MUST be idempotent on `event.id`.
    async fn append(&self, event: Event) -> Result<(), StoreError>;

    /// Return every event whose topic equals `topic`, ordered by
    /// `timestamp` ascending.
    async fn query(&self, topic: &str) -> Result<Vec<Event>, StoreError>;

    /// Look up a single event by id; returns `None` if it does not exist.
    async fn get(&self, id: Uuid) -> Result<Option<Event>, StoreError>;
}

/// In-memory implementation used until the JSONL/SQLite-backed store from
/// stage 1 of the migration lands. Useful for unit tests and the
/// `control-plane-server-rs` aggregator's fallback path.
#[derive(Debug, Default)]
pub struct InMemoryEventStore {
    events: Arc<RwLock<Vec<Event>>>,
}

impl InMemoryEventStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl EventStore for InMemoryEventStore {
    async fn append(&self, event: Event) -> Result<(), StoreError> {
        let mut guard = self.events.write().await;
        if guard.iter().any(|existing| existing.id == event.id) {
            // duplicate appends are idempotent no-ops
            return Ok(());
        }
        guard.push(event);
        Ok(())
    }

    async fn query(&self, topic: &str) -> Result<Vec<Event>, StoreError> {
        let guard = self.events.read().await;
        let mut matching: Vec<Event> = guard
            .iter()
            .filter(|event| event.topic == topic)
            .cloned()
            .collect();
        matching.sort_by_key(|event| event.timestamp);
        Ok(matching)
    }

    async fn get(&self, id: Uuid) -> Result<Option<Event>, StoreError> {
        let guard = self.events.read().await;
        Ok(guard.iter().find(|event| event.id == id).cloned())
    }
}

/// Build a fresh `Event` with a v4 UUID and the canonical schema version.
/// This is the single construction path used by the broker so the schema
/// version never drifts.
pub fn new_event(topic: impl Into<String>, payload: serde_json::Value) -> Event {
    Event {
        id: Uuid::new_v4(),
        topic: topic.into(),
        payload,
        timestamp: Utc::now(),
        schema_version: SCHEMA_VERSION.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn append_is_idempotent_on_id() {
        let store = InMemoryEventStore::new();
        let event = new_event("policy.decision.evaluated", json!({"decision": "allow"}));
        store.append(event.clone()).await.unwrap();
        store.append(event.clone()).await.unwrap();
        let events = store.query("policy.decision.evaluated").await.unwrap();
        assert_eq!(events.len(), 1);
    }

    #[tokio::test]
    async fn query_returns_only_matching_topic() {
        let store = InMemoryEventStore::new();
        store
            .append(new_event("a", json!({})))
            .await
            .unwrap();
        store
            .append(new_event("b", json!({})))
            .await
            .unwrap();
        let events = store.query("a").await.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].topic, "a");
    }
}