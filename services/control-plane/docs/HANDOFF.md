# Control Plane Rust Migration Handoff

## Current progress

- ADR-018 (`docs/adr/ADR-018-control-plane-rust-split.md`) is drafted and
  records the five-crate split, the staged migration plan, and the
  `.mjs` ↔ Rust boundary strategy.
- Five Rust crate skeletons land under
  `services/control-plane/src-rs/`:
  - `control-plane-event-store-rs/`
  - `control-plane-outbox-rs/`
  - `control-plane-resource-policy-rs/`
  - `control-plane-view-registry-rs/`
  - `control-plane-server-rs/`
- Each crate ships a `Cargo.toml` with the agreed dependency floor and a
  `src/lib.rs` that defines the core struct, the core trait, an in-memory
  implementation, and `#[cfg(test)]` smoke tests so the library is
  `cargo check`-able.
- `cargo check`, `cargo build`, and `cargo test` are explicitly out of scope
  for this handoff; CI wiring for Rust lands with stage 5 of the migration
  plan.

## Crate dependency graph

```
control-plane-server-rs
   ├── control-plane-event-store-rs        (path)
   ├── control-plane-outbox-rs             (path)
   ├── control-plane-resource-policy-rs    (path)
   └── control-plane-view-registry-rs      (path)
```

`server` aggregates the rest. `view-registry` is the only crate that
logically depends on `event-store` and `resource-policy` at the design
level; today both packages remain leaf so the skeleton stays trivially
`cargo check`-able. The path dependencies are declared in
`control-plane-server-rs/Cargo.toml`; the leaf crates will get cross-talk
backlinks once stage 4 lands the projection pipeline.

## Next stage (stage 1)

- Implement the `EventStore` trait for a JSONL-backed store that reads from
  `.cache/epap-control-plane/jobs/*/events.jsonl`.
- Wire `observability-events.mjs` and the read path of
  `commit-ledger/persistence.mjs` behind the crate via the native sidecar
  (`napi-rs`).
- Keep `package.json` `start` and `dev` scripts unchanged so the existing
  smoke and test suites stay green.
- Run `cargo fmt`, `cargo clippy` and `cargo test` for the crate as the
  exit criteria.

## Node mjs ↔ Rust dual entry strategy

During the migration we keep two entry points:

1. **Primary entry** — `src/server.mjs`, started by `pnpm --filter
   @axi/workstation-control-plane dev` / `start`. Public surface and
   IM gateway contract stay byte-identical.
2. **Rust entry** — `control-plane-server-rs` (`serve` function). Loaded
   from `src/server.mjs` through either:
   - a `napi-rs` `cdylib` artifact (preferred once stage 5 ships), or
   - a `127.0.0.1:<port>` HTTP sidecar (fallback while the
     `napi-rs` binding is not built).

The migration never replaces the `package.json` scripts. Each stage moves
one `.mjs` module's logic into the corresponding Rust crate, leaves a thin
forwarder in `.mjs`, and adds a conformance test that asserts the response
shape is unchanged.

## Mapping: Rust crate ↔ existing mjs module

| Rust crate | `.mjs` module it replaces | ADR-018 stage |
|---|---|---|
| `control-plane-event-store-rs` | `src/commit-ledger/persistence.mjs`, `src/commit-ledger/ingestion.mjs`, `src/observability-events.mjs`, the `/events` HTTP route family | Stage 1 |
| `control-plane-outbox-rs` | `src/commit-ledger/scheduler.mjs`, `src/commit-ledger/fs-watcher.mjs` | Stage 2 |
| `control-plane-resource-policy-rs` | `evaluateGovernancePolicy`, `evaluateSurfaceExecutionPolicy`, `requirePolicyDecisionRef` inside `src/control-plane.mjs` | Stage 3 |
| `control-plane-view-registry-rs` | `snapshot` section of `src/control-plane.mjs`, `src/personal-os.mjs`, `src/pairing.mjs` projection glue | Stage 4 |
| `control-plane-server-rs` | `src/server.mjs` route table and IM envelope normalization at the boundary | Stage 5 |

## Verification

- Run the existing smoke test against the unchanged `.mjs` surface:
  `pnpm --filter @axi/workstation-control-plane smoke`.
- Run the existing Node test suite:
  `node --test src/**/*.test.ts test/*.test.mjs`.
- When CI is wired for Rust, each crate runs `cargo fmt --check`,
  `cargo clippy -- -D warnings` and `cargo test --all-features`.
- The six-layer boundary check is part of the verification matrix; the
  Rust crates do not introduce a new owner for any layer.

## Open questions

- When `foundation/axi-workspace-rs/` opens, the five crates migrate
  into it as workspace members. Confirm the workspace naming convention
  before stage 5.
- Decide between the `napi-rs` and the HTTP sidecar patterns for stage 5.
- Decide whether `cargo check` becomes a required CI check before stage
  5 lands or stays opt-in.

## References

- ADR-018: `docs/adr/ADR-018-control-plane-rust-split.md`
- ADR-010: `foundation/workspace-governance/docs/adr/ADR-010-axi-observability-architecture.md`
- ADR-009: `apps/axi-docs/docs/axi-workspace-governance/adr/ADR-009-workflow-first-bounded-agent.md`