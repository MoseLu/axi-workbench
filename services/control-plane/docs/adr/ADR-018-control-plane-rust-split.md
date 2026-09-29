---
id: adr-control-plane-018
title: ADR-018 Control Plane Rust Migration Split
type: reference
status: Proposed
tags: [control-plane, rust, migration, event-store, outbox, policy, view-registry, server]
created: 2026-09-29
modified: 2026-09-29
agent-readable: true
---

# ADR-018 Control Plane Rust Migration Split

## Status

Proposed on 2026-09-29.

This ADR records the planned split of the `@axi/workstation-control-plane`
service (a Node.js `.mjs` runtime carrying approximately 22 000 LOC and 27
modules in `services/control-plane/src/`) into a workspace-aligned family of
Rust crates. The split is proposed; no Rust crate is published or wired into
the runtime in this ADR. Crate skeletons land in
`services/control-plane/src-rs/` as `cargo check` is explicitly out of scope
for the migration PR.

## Context

`@axi/workstation-control-plane` is the Workstation Broker / Event / Audit
composite core. The Node.js implementation today couples the broker,
append-only event ledger, RBAC policy kernel, view/snapshot registry and the
HTTP/gRPC surface into a single `src/` tree:

| Concern | Current `.mjs` location | Approx. LOC |
|---|---|---|
| HTTP/gRPC server + IM envelope routing | `src/server.mjs` | ~1 500 |
| Broker / control surface (`evaluateGovernancePolicy`, `requirePolicyDecisionRef`, `createControlJob`, `cancelControlJob`, `transitionGovernanceRisk`) | `src/control-plane.mjs` | ~6 100 |
| Append-only event ledger (`audit.jsonl`, Workspace Events, `/events/:id`, pagination) | `src/commit-ledger/persistence.mjs`, `src/commit-ledger/ingestion.mjs`, `src/observability-events.mjs` | ~1 150 |
| Outbox-style commit replay (`scheduler.mjs`, `fs-watcher.mjs`, `ingestion.mjs`) | `src/commit-ledger/scheduler.mjs`, `src/commit-ledger/fs-watcher.mjs` | ~375 |
| View / snapshot registry (governance snapshot, Personal OS projection, mobile scan projection) | `src/control-plane.mjs` snapshot section, `src/personal-os.mjs`, `src/pairing.mjs` | ~1 700 |
| Idempotency / pairing / RBAC adapter glue | `src/idempotency.mjs`, `src/pairing.mjs` | ~990 |
| EPS runtime probe / scanner | `src/eps/*.mjs` | ~250 |

Three problems motivate the migration:

1. **Missing type boundary at the event contract.** Workspace Event payloads
   travel between the broker, the event store, the view registry and the
   resource policy kernel. Today the contract is enforced by ad-hoc
   `firstString(...)` / `safeFileName(...)` helpers and JavaScript object
   spread, not by a typed schema. A new field can be added in one module and
   silently missing in another; failures show up only at IM gateway replay.
2. **Composite core, no isolation.** `control-plane.mjs` (6 100 LOC) owns the
   broker, the policy kernel, the view/snapshot registry and parts of the
   event ledger. Tests must boot the whole control plane to exercise one
   RBAC grant. The same module is read by the LangGraph workflow, the
   Personal OS projection and the Personal OS route — any refactor ripples
   into three or more call paths.
4. **Concurrency ceiling.** `node:sqlite` plus single-threaded JS scheduling
   for `/jobs/:id/events`, `/events` pagination, and the
   `commit-ledger/scheduler.mjs` replay loop is adequate at ~50 RPS, and
   becomes the bottleneck above that. `tokio` + `serde` + a Rust
   `EventStore`/`Outbox` would let us keep the existing `.mjs` API on top of
   a typed, multi-task backend without rewriting consumers.

## Decision

We split the control plane into **five workspace crates** under
`services/control-plane/src-rs/`:

| Crate | Rust responsibility | mjs surface it will eventually own |
|---|---|---|
| `control-plane-event-store-rs` | Append-only Workspace Event store; typed `Event` struct; `EventStore` trait; `InMemoryEventStore` and (later) a JSONL/SQLite-backed implementation. | `commit-ledger/persistence.mjs`, `commit-ledger/ingestion.mjs`, `observability-events.mjs`, the `/events` family of HTTP routes. |
| `control-plane-outbox-rs` | Outbox-style replay: `OutboxMessage`, `Outbox` trait (`enqueue`, `pending`, `ack`, `nack`), retry/backoff policy. | `commit-ledger/scheduler.mjs`, `commit-ledger/fs-watcher.mjs`, the file-watcher -> ingest pump. |
| `control-plane-resource-policy-rs` | Resource policy kernel: `ResourcePolicy`, `PolicyRule`, `PolicyEngine` trait, `PolicyDecision::{Allow,Deny,RequireApproval,RequireAdditionalEvidence}`. Mirrors `evaluateGovernancePolicy` and `evaluateSurfaceExecutionPolicy`. | `evaluateGovernancePolicy`, `evaluateSurfaceExecutionPolicy`, `requirePolicyDecisionRef`, RBAC grant evaluation in `control-plane.mjs`. |
| `control-plane-view-registry-rs` | View / snapshot registry: `View` struct (kind + schema), `ViewRegistry` trait (`register`, `resolve`, `list`), Personal OS + governance snapshot projections. | `snapshot` section of `control-plane.mjs`, `personal-os.mjs`, `pairing.mjs` projection glue. |
| `control-plane-server-rs` | HTTP/gRPC server crate that owns the 4 sibling crates as dependencies, exposes the existing route set, and ships a thin `ControlPlaneServer::serve(SocketAddr)` entry point. | `src/server.mjs`, the route table, IM envelope normalization at the boundary. |

### Module split rationale

- **`event-store` is the leaf.** Every other crate reads events. Making it a
  leaf crate keeps the dependency graph acyclic and lets the broker depend on
  the store without the store ever depending back on the policy or view
  crates.
- **`outbox-replay` depends only on `event-store`.** The outbox enqueues
  `OutboxMessage` envelopes whose bodies are serialized events. It does not
  need to know about RBAC or views.
- **`resource-policy` is independent of the event store.** The policy kernel
  reads grants from disk and returns a `PolicyDecision` synchronously. It can
  be compiled and tested in isolation; no event-store or outbox dependency.
- **`view-registry` depends on `event-store` and `resource-policy`.** A view
  is a projection of typed events plus the policy decision that authorized the
  underlying write; both inputs must be available at compile time.
- **`server` aggregates the four.** The server crate owns the `tokio` runtime,
  the `axum` (or `hyper` + tower) HTTP surface, and the migration shim that
  keeps the existing `.mjs` consumers working during the transition.

### Cargo workspace shape

Because `foundation/axi-workspace-rs/` does not yet exist, the five crates
live under the control-plane service at
`services/control-plane/src-rs/`. Each crate ships:

- `Cargo.toml` with `edition = "2021"`, package name matching the table above,
  version `0.1.0`, and a fixed dependency floor:
  `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"`,
  `thiserror = "1"`, `tokio = { version = "1", features = ["full"] }`,
  `async-trait = "0.1"`, `tracing = "0.1"`, plus `uuid = "1"` and
  `chrono = "0.4"` where the crate needs stable identity and timestamps.
- `src/lib.rs` exposing the core struct + the core trait as public items plus
  one or two stub functions so the library is `cargo check`-able later.
- No `examples/`, `tests/` or `Cargo.lock` committed yet — this ADR stops at
  the skeleton, not the verification.

When `foundation/axi-workspace-rs/` is later opened, the five crates migrate
into it as members of the workspace `Cargo.toml`; the source files move
unchanged.

### mjs ↔ Rust boundary during the migration

We keep `src/server.mjs` and the `package.json` `start` script unchanged.
The Node.js process continues to be the public boundary for the IM gateway,
the resource gateway, the workflow engine and the Workbench frontends. The
five Rust crates are introduced **behind** the `.mjs` server through one of
two patterns:

1. **Native sidecar (later phases).** Each Rust crate compiles to a
   `cdylib`; the Node.js process loads it through `node:ffi` / `napi-rs`.
   The `.mjs` modules swap their in-memory implementations for calls into
   the Rust crate while preserving their public function signatures.
2. **HTTP / gRPC sidecar (fallback).** If `napi-rs` is unavailable or the
   server crate is not yet stable enough to embed, `control-plane-server-rs`
   runs as a `127.0.0.1:<port>` HTTP service and the `.mjs` server forwards
   routes that have been migrated.

The exact pattern is decided per stage, not at ADR acceptance.

## Consequences

### Positive

- **Typed event contract.** `Event`, `OutboxMessage`, `ResourcePolicy`,
  `View` and `PolicyDecision` become `serde::Serialize`/`Deserialize` types.
  Renames and field additions are caught at compile time and at the
  `serde_json` boundary.
- **Conformance testing in isolation.** `cargo test` against
  `control-plane-resource-policy-rs` does not need the broker or the HTTP
  server. The same applies to `event-store` and `outbox-replay`.
- **Concurrency headroom.** `tokio` multi-task scheduling for ingestion,
  outbox replay and HTTP request handling removes the single-threaded
  bottleneck on `/events` pagination and the commit-ledger scheduler.
- **Workspace alignment.** The split mirrors the existing
  Broker / Event / Audit composite core contract. Crate names map 1:1 onto
  the `.mjs` modules they will replace, so a future maintainer can grep one
  crate to find the surface it owns.
- **Lower coupling for the workbench frontends.** Frontends, the resource
  gateway and the workflow engine depend on the existing `.mjs` HTTP surface,
  which is preserved. They do not need to migrate at all during the Rust
  rollout.

### Negative / risks

- **Event schema sync.** Every Rust `Event` field needs a matching
  `firstString(...)`/JSON shape in the `.mjs` consumer until that consumer
  is migrated. We mitigate by keeping the `serde_json::Value` payload field
  opaque and pinning one `SCHEMA_VERSION = "control-plane-event.v1"` constant
  in the Rust crate. Schema drift is caught by a cross-language conformance
  test added in stage 5.
- **Two language toolchains.** Adding Rust raises the local environment
  requirement from Node.js ≥ 22.5 to Node.js ≥ 22.5 **plus** `rustup` 1.95+
  and a working `cargo`. We mitigate by keeping `cargo check` and
  `cargo build` opt-in (default `package.json` scripts stay on `node`).
- **Native module deployment on macOS + Linux.** `napi-rs` artifacts must be
  shipped per-platform. We mitigate by falling back to the HTTP sidecar
  pattern for the first release.
- **Migration debt.** The five crates are skeletons today. Until each one
  reaches parity with the `.mjs` module it replaces, the system carries two
  implementations. The HANDOFF document tracks per-crate parity state.
- **No `cargo check` in CI yet.** This ADR adds the skeleton without
  enabling CI on Rust. A follow-up PR wires `cargo fmt`, `cargo clippy` and
  `cargo test` into the workbench pipeline.

## Migration Plan

The migration is staged in five steps. Each stage ends with the existing
`.mjs` surface unchanged and at least one Rust crate passing its own unit tests.
Stages are sequenced from leaf crates to the aggregating server crate.

### Stage 1 — `control-plane-event-store-rs`

- Land the crate skeleton under `src-rs/control-plane-event-store-rs/`.
- Implement the `EventStore` trait for `InMemoryEventStore` and a
  JSONL-backed store that reads from `.cache/epap-control-plane/jobs/*/events.jsonl`.
- Migrate `observability-events.mjs` and the read path of
  `commit-ledger/persistence.mjs` behind the crate via the native sidecar.
- Exit criteria: `/events` and `/events/:id` continue to pass
  `node --test src/**/*.test.ts`.

### Stage 2 — `control-plane-outbox-rs`

- Land the crate skeleton.
- Port `commit-ledger/scheduler.mjs` and `commit-ledger/fs-watcher.mjs`
  semantics into the `Outbox` trait.
- Wire `Ingestion` -> `Outbox` so an event is enqueued before it is
  appended; `Outbox::ack` is called only after the append succeeds.
- Exit criteria: the commit-ledger e2e test
  (`commit-ledger/__test_e2e.mjs`) still passes against the new path.

### Stage 3 — `control-plane-resource-policy-rs`

- Land the crate skeleton.
- Port `evaluateGovernancePolicy` and `evaluateSurfaceExecutionPolicy`
  semantics into the `PolicyEngine` trait and the
  `PolicyDecision::{Allow,Deny,RequireApproval,RequireAdditionalEvidence}`
  enum.
- The `.mjs` `requirePolicyDecisionRef` helper becomes a thin wrapper that
  forwards to the Rust crate.
- Exit criteria: RBAC grant typecheck tests (`control-plane.test.ts`) still
  pass and the `policy_decision.evaluated` Workspace Event is unchanged.

### Stage 4 — `control-plane-view-registry-rs`

- Land the crate skeleton.
- Port the snapshot / governance projection, the Personal OS projection
  and the pairing projection.
- The `ViewRegistry` trait is the only public surface; the `.mjs` consumer
  receives a `serde_json::Value` shape identical to today's.
- Exit criteria: `GET /snapshot`, `GET /api/v1/control-plane/personal-os/*`
  and pairing routes return byte-identical JSON for the test fixtures.

### Stage 5 — `control-plane-server-rs`

- Land the crate skeleton as the aggregator of stages 1-4.
- Move the route table from `src/server.mjs` into `axum` handlers.
- Keep `src/server.mjs` as the Node entry point that boots the Rust binary
  through the native or HTTP sidecar.
- Add cross-language schema drift conformance tests against
  `SCHEMA_VERSION = "control-plane-event.v1"`.
- Enable `cargo fmt`, `cargo clippy` and `cargo test` in the workbench CI.
- Exit criteria: `pnpm --filter @axi/workstation-control-plane smoke`
  passes, the six-layer boundary check still passes, and a Rust unit test
  suite covers each of the four leaf crates plus the aggregator.

## References

- ADR-010 Axi Observability Architecture — establishes the workspace-wide
  observability contract that the new event store will preserve.
- ADR-005 Agent BFF Ownership — defines the Broker / Event / Audit composite
  core boundary that this split aligns to.
- ADR-009 Workflow First Bounded Agent — keeps LangGraph on the broker
  side of this split; the server crate does not absorb workflow state.
- The `.mjs` modules listed in the Context table.