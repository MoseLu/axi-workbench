//! `control-plane-resource-policy-rs`
//!
//! Resource policy kernel for the Axi Workstation control plane.
//!
//! Stage 3 of the migration described in
//! `docs/adr/ADR-018-control-plane-rust-split.md`. This crate replaces
//! `evaluateGovernancePolicy`, `evaluateSurfaceExecutionPolicy` and
//! `requirePolicyDecisionRef` from `src/control-plane.mjs`. The `.mjs`
//! helpers become thin wrappers that forward their arguments unchanged to
//! the [`PolicyEngine`] trait.
//!
//! Today the crate is a skeleton: the public types, the decision enum and
//! a deny-by-default [`PolicyEngine`] implementation are wired so the
//! library is `cargo check`-able. Real grant loading, scope inheritance,
//! validity windows and `require_approval` escalation land in stage 3.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// One condition/action pair inside a [`ResourcePolicy`]. The condition is
/// kept as a JSON-encoded boolean expression so the policy kernel does not
/// need its own DSL; the action is a stable string identifier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicyRule {
    pub condition: String,
    pub action: String,
}

/// A named bundle of [`PolicyRule`]s scoped to a resource type. The id is
/// stable across reboots so the audit stream can reference it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourcePolicy {
    pub id: String,
    pub resource_type: String,
    pub rules: Vec<PolicyRule>,
}

/// Outcome of a policy evaluation. The `RequireApproval` and
/// `RequireAdditionalEvidence` arms mirror the Workspace RBAC readiness
/// contract in `services/control-plane/README.md` (Phase 5); the `.mjs` server
/// maps them to HTTP 403 / 409.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PolicyDecision {
    Allow,
    Deny,
    RequireApproval { approval_id: String },
    RequireAdditionalEvidence { evidence_refs: Vec<String> },
}

impl PolicyDecision {
    pub fn is_allow(&self) -> bool {
        matches!(self, PolicyDecision::Allow)
    }
}

/// Errors produced by a [`PolicyEngine`] implementation.
#[derive(Debug, Error)]
pub enum PolicyError {
    #[error("grant source is not configured for resource {resource_type}")]
    GrantsNotConfigured { resource_type: String },
    #[error("policy kernel rejected input: {0}")]
    InvalidInput(String),
    #[error("policy engine backend failure: {0}")]
    Backend(String),
}

/// The contract every policy engine must satisfy. The engine reads its
/// grants from a source owned by the registry; an empty or unavailable
/// grant set MUST default to `Deny` (fail-closed).
#[async_trait]
pub trait PolicyEngine: Send + Sync {
    async fn evaluate(
        &self,
        ctx: &serde_json::Value,
    ) -> Result<PolicyDecision, PolicyError>;
}

/// Deny-by-default engine. Used until stage 3 lands the grant-loader
/// bridge. Returning `Deny` matches the README "empty or unavailable grant
/// set defaults to deny" guarantee.
#[derive(Debug, Default, Clone, Copy)]
pub struct DenyByDefaultPolicyEngine;

#[async_trait]
impl PolicyEngine for DenyByDefaultPolicyEngine {
    async fn evaluate(
        &self,
        _ctx: &serde_json::Value,
    ) -> Result<PolicyDecision, PolicyError> {
        Ok(PolicyDecision::Deny)
    }
}

/// Construct a deny decision from a structured reason. Mirrors the
/// `firstString(...)` pattern the `.mjs` consumer uses to surface denial
/// reasons in 4xx responses.
pub fn deny(reason: impl Into<String>) -> PolicyDecision {
    tracing::warn!(reason = %reason.into(), "policy engine forced deny");
    PolicyDecision::Deny
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn deny_by_default_engine_returns_deny() {
        let engine = DenyByDefaultPolicyEngine;
        let decision = engine.evaluate(&json!({})).await.unwrap();
        assert_eq!(decision, PolicyDecision::Deny);
    }

    #[test]
    fn decision_allow_helper() {
        assert!(PolicyDecision::Allow.is_allow());
        assert!(!PolicyDecision::Deny.is_allow());
    }
}