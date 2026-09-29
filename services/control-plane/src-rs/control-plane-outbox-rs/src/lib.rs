//! `control-plane-outbox-rs`
//!
//! Outbox-style replay for the Axi Workstation control plane.
//!
//! Stage 2 of the migration described in
//! `docs/adr/ADR-018-control-plane-rust-split.md`. The crate mirrors
//! `commit-ledger/scheduler.mjs` and `commit-ledger/fs-watcher.mjs`:
//! every Workspace Event that must be replayed downstream (gateway, audit
//! stream, external notification relay) is wrapped in an [`OutboxMessage`]
//! and pushed into an [`Outbox`]. A background drain worker calls
//! [`Outbox::pending`] and acks the message only after the downstream
//! append succeeds.
//!
//! Today the crate is a skeleton: the type and trait exist and an
//! in-memory implementation is wired so the library is `cargo check`-able.

use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;
use uuid::Uuid;

/// A single message parked in the outbox. `destination` is the logical
/// downstream (`"audit.jsonl"`, `"policy-events"`, `"external-relay"`).
/// `payload` is opaque so the outbox does not need to know the event shape;
/// schema drift is caught by the `Event` type in
/// `control-plane-event-store-rs`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutboxMessage {
    pub id: Uuid,
    pub destination: String,
    pub payload: serde_json::Value,
    pub enqueued_at: DateTime<Utc>,
    #[serde(default)]
    pub attempts: u32,
}

impl OutboxMessage {
    pub fn new(
        destination: impl Into<String>,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            destination: destination.into(),
            payload,
            enqueued_at: Utc::now(),
            attempts: 0,
        }
    }
}

/// Errors produced by an [`Outbox`] implementation.
#[derive(Debug, Error)]
pub enum OutboxError {
    #[error("outbox message with id {id} not found")]
    NotFound { id: Uuid },
    #[error("outbox backend failure: {0}")]
    Backend(String),
    #[error("invalid destination: {0}")]
    InvalidDestination(String),
}

/// The contract every outbox implementation must satisfy.
///
/// `enqueue` is idempotent on `OutboxMessage::id`; `ack` removes a
/// successfully delivered message; `nack` increments `attempts` and keeps
/// the message available for the next drain pass.
#[async_trait]
pub trait Outbox: Send + Sync {
    async fn enqueue(&self, msg: OutboxMessage) -> Result<(), OutboxError>;

    async fn pending(&self) -> Result<Vec<OutboxMessage>, OutboxError>;

    async fn ack(&self, id: Uuid) -> Result<(), OutboxError>;

    async fn nack(&self, id: Uuid) -> Result<(), OutboxError>;
}

/// In-memory implementation. Replays stay in-process until stage 2 lands
/// the persistent ring buffer or SQLite-backed outbox.
#[derive(Debug, Default)]
pub struct InMemoryOutbox {
    pending: Arc<RwLock<Vec<OutboxMessage>>>,
}

impl InMemoryOutbox {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl Outbox for InMemoryOutbox {
    async fn enqueue(&self, msg: OutboxMessage) -> Result<(), OutboxError> {
        if msg.destination.trim().is_empty() {
            return Err(OutboxError::InvalidDestination(msg.destination));
        }
        let mut guard = self.pending.write().await;
        if guard.iter().any(|existing| existing.id == msg.id) {
            return Ok(());
        }
        guard.push(msg);
        Ok(())
    }

    async fn pending(&self) -> Result<Vec<OutboxMessage>, OutboxError> {
        let guard = self.pending.read().await;
        Ok(guard.clone())
    }

    async fn ack(&self, id: Uuid) -> Result<(), OutboxError> {
        let mut guard = self.pending.write().await;
        let before = guard.len();
        guard.retain(|msg| msg.id != id);
        if guard.len() == before {
            return Err(OutboxError::NotFound { id });
        }
        Ok(())
    }

    async fn nack(&self, id: Uuid) -> Result<(), OutboxError> {
        let mut guard = self.pending.write().await;
        let msg = guard
            .iter_mut()
            .find(|msg| msg.id == id)
            .ok_or(OutboxError::NotFound { id })?;
        msg.attempts = msg.attempts.saturating_add(1);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn enqueue_rejects_empty_destination() {
        let outbox = InMemoryOutbox::new();
        let msg = OutboxMessage {
            id: Uuid::new_v4(),
            destination: " ".to_string(),
            payload: json!({}),
            enqueued_at: Utc::now(),
            attempts: 0,
        };
        let err = outbox.enqueue(msg).await.unwrap_err();
        assert!(matches!(err, OutboxError::InvalidDestination(_)));
    }

    #[tokio::test]
    async fn ack_removes_message() {
        let outbox = InMemoryOutbox::new();
        let msg = OutboxMessage::new("audit.jsonl", json!({"id": "abc"}));
        let id = msg.id;
        outbox.enqueue(msg).await.unwrap();
        assert_eq!(outbox.pending().await.unwrap().len(), 1);
        outbox.ack(id).await.unwrap();
        assert!(outbox.pending().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn nack_increments_attempts() {
        let outbox = InMemoryOutbox::new();
        let msg = OutboxMessage::new("audit.jsonl", json!({"id": "abc"}));
        let id = msg.id;
        outbox.enqueue(msg).await.unwrap();
        outbox.nack(id).await.unwrap();
        let pending = outbox.pending().await.unwrap();
        assert_eq!(pending[0].attempts, 1);
    }
}