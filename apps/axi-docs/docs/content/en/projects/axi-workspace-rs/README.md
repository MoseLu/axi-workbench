---
id: axi-docs-en-projects-axi-workspace-rs
title: Axi Workspace Rust Monorepo
type: project
status: published
tags: [Axi Docs, Projects, foundation, rust, governance, monorepo, sop, kernel, runtime]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workspace Rust Monorepo
graph-tags: [Foundation, Rust, Governance]
description: 14-crate Rust workspace monorepo delivering the Axi governance backend (SOP Kernel, Decision Engine, Capability Broker, Agent Runtime, Event/Audit, Provider Ports) per ADR-010. Includes the workspace-project Rust port and the per-project workbench CLI (ADR-012 M4).
project:
  id: axi-workspace-rs
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-workspace-rs
  source-section: shared
---

# Axi Workspace Rust Monorepo

> Source of truth:
> [`/Volumes/code/workspace/foundation/axi-workspace-rs/`](/Volumes/code/workspace/foundation/axi-workspace-rs/).
> Section: shared / Partition: `foundation/`.

## Summary

The Axi Workspace Rust Monorepo is the **canonical Rust implementation
of the Axi governance backend**, governed by ADR-010 and anchored by
ADR-011..019. Its `Cargo.toml` `[workspace] members` enumerates
**14 crates** (resolved from `01ed7e3b` consolidation + post-M4
`provider-ports-rs` addition): `axi-kernel-rs`, `axi-workbench-cli-rs`,
`axi-runtime-rs`, `axi-sync-rs`, `axi-inbox-rs`, `workspace-governance-rs`,
`api-gateway-rs`, `control-plane-event-store-rs`, `control-plane-outbox-rs`,
`control-plane-resource-policy-rs`, `control-plane-view-registry-rs`,
`control-plane-server-rs`, `axi-observability-rs`, `provider-ports-rs`
(`Cargo.toml:3-18`). Each crate was migrated from its original project
location and the source `src-rs/<crate>` directories were deleted from
the originating projects in the same commit.

The monorepo is the runtime deliverable behind the Node
`workspace-project` CLI's read-only subset (Phase 1) and the Python
`axi-workbench-cli`'s full CLI surface (M1-M4 of ADR-012). The headline
capability chain — `SOP → Decision → ExecutionPlan → Guard → Tool →
Audit` — lives in `axi-runtime-rs` (`HANDOFF.md:62-65`); the
`workspace-governance-rs` crate holds the parity-port of 35 production
Node scripts; `axi-workbench-cli-rs` (M4 landed 2026-10-03 in
commit `378e431`) provides the `workbench {health,graph,project}`
binary at `target/debug/workbench`. The `provider-ports-rs` crate
holds the typed provider-ports contract for GitHub/Cloudflare/SSH/Aliyun.

**Current state (HEAD `8f470d7`, branch `agent/install-git-hooks`, 223
ahead-of-origin, M11 Wave 1 acceptance 2026-10-03)**: `cargo test
--workspace` **2943 passed / 0 failed** (2816 → +127 across M11 Wave 1
four tracks), `cargo clippy --workspace --all-targets -- -D warnings`
**0 error**, `cargo fmt --all --check` **green** (rustfmt nightly-config
remediation `da98aa0`+`8f470d7` brought the gate back to green for the
first time since M7.1). `cargo deny` advisories FAIL = pre-existing
(RUSTSEC-2025-0020 pyo3 0.21.2 + yanked yoke-derive). M11 Wave 1
landed 5 specs (PROV-013 Vault D14/D15, CP-EVT-008 D16/D17,
CP-SRV-004 D22/D23, KRN-005+SYN-005 D29/D33) across 4 parallel
impl branches, all merged `--no-ff` to `agent/install-git-hooks`.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Workspace root | `Cargo.toml` workspace v2 (resolver = "2"), MSRV 1.85, edition 2021 | 14 crates listed in `members[]` (`Cargo.toml:3-18`) |
| Async runtime | tokio 1.41 with `macros/net/rt-multi-thread/sync/time/signal` | `Cargo.toml:35` |
| HTTP | axum 0.8 + tower 0.5 + http 1.1 | `Cargo.toml:36-38` |
| HTTP client | reqwest 0.12, default-features false, `rustls-tls` only | `Cargo.toml:39` |
| Storage | rusqlite 0.32 (bundled) + dashmap 6 + parking_lot 0.12 | `Cargo.toml:40-43` |
| CLI parsing | clap 4 with `derive` feature | `Cargo.toml:44` |
| Observability | tracing 0.1 + tracing-subscriber 0.3 + opentelemetry 0.22 + opentelemetry_sdk 0.22 (rt-tokio) + prometheus 0.13 | `Cargo.toml:45-49` |
| Serde / error | serde 1.0 (derive) + serde_json 1.0 + anyhow 1.0 + thiserror 2.0 + uuid 1.11 (v4, serde) | `Cargo.toml:29-33` |
| Time / hash / graph | chrono 0.4 (serde) + sha2 0.10 + petgraph 0.6 | `Cargo.toml:34,51-52` |
| Async hot-path | notify 6 + regex 1 | `Cargo.toml:41,53` |
| Test harness | assert_cmd 2 + predicates 3 + tempfile 3.14 | `Cargo.toml:54-55,50` |
| Profile | `[profile.release] lto=thin codegen-units=1 strip=symbols`; `[profile.dev] debug=1` | `Cargo.toml:57-61` |
| License | MIT OR Apache-2.0 | `Cargo.toml:25` |
| Verification | GitHub Actions `rust-ci` (fmt / clippy / test / deny / audit five lanes) | `README.md:3` |

## Project Layout

```text
axi-workspace-rs/
├── Cargo.toml                          # workspace v2 resolver, 14 members
├── AGENTS.md                           # Lore Commit Protocol + 5 trailer constraints
├── README.md                           # 14-crate table + verification commands
├── HANDOFF.md                          # 26.4k-token handoff (M1-M11 + Wave-U3 + M11 Wave 1)
├── cargo-deny.toml / clippy.toml / rustfmt.toml / deny.toml
├── crates/
│   ├── api-gateway-rs/                 # axum router + rate limit + idempotency + circuit breaker
│   ├── axi-inbox-rs/                   # PriorityQueue + DedupeGate + adapter scaffolding
│   ├── axi-kernel-rs/                  # Envelope + ObjectKind + schema-gen + MigrationRunner
│   ├── axi-observability-rs/           # LogRecord + W3C trace + SLI metrics + OtlpExporter + LogSampler
│   ├── axi-runtime-rs/                 # SOP Kernel + Decision Engine + Capability Broker + Orchestrator + AuditLog
│   ├── axi-sync-rs/                    # DeliveryQueue + ImpactClassifier + Batcher + CheckpointStore + LocalQueue<T>
│   ├── axi-workbench-cli-rs/           # Per-project `workbench` CLI (M4 landed) + 8 health checks
│   ├── control-plane-event-store-rs/   # JSONL append-only + chain_hash + auto-seal + TopicIndex
│   ├── control-plane-outbox-rs/        # DurableOutbox + OutboxAdmin + batched drain worker
│   ├── control-plane-resource-policy-rs/ # typed policy + GrantLoader + ScopeSet + PolicyDecisionLog
│   ├── control-plane-server-rs/        # ServerConfig + composite health + drain auth + ReadyGate
│   ├── control-plane-view-registry-rs/ # ProjectionSet + SnapshotWriter + MaterializedView
│   ├── provider-ports-rs/              # Typed provider ports (GitHub/Cloudflare/SSH/Aliyun/Kube/Vault/Webhook)
│   └── workspace-governance-rs/        # 35 production Node script parity-port + 32 bins
├── docs/                               # 18 follow-up planning docs + M10/M11/M12 specs + decisions
│   ├── MIGRATION-MATRIX.md
│   ├── CAPABILITY-INVENTORY.md
│   ├── OWNER_DECISION_BACKLOG.md       # D1-D93 (48+ owner-decision tables)
│   ├── BRANCH-STATE-SYNC.md
│   ├── SECURITY-AUDIT-2026-09-30.md
│   ├── VERIFICATION.md
│   ├── M7-WAVE-CONSOLIDATION.md
│   ├── M7-CORRECTION.md
│   ├── M4-CLOSEOUT.md
│   ├── M10-specs/00-OWNER-PACKET-V2.md
│   ├── M11-specs/                      # 10 per-spec implementation plans
│   ├── M12-specs/                      # 5 Tier 4 plans (CP-RP-007 / CP-SRV-005 / CP-VW-006 / OBS-015 / CP-EVT-009)
│   ├── decisions/2026-10-03-m11-blocking-decisions.md
│   ├── designs/                        # cargo audit / rustfmt remediation designs
│   ├── investigations/                 # 5-track cross-reference audits
│   ├── branches/ cargo/ cargo-lock/ ci/ docs/ registry/ scripts/ security/ sync/ testing/ wave-u/
│   ├── logs/submit/                    # post-commit submit-log drain
│   ├── plans/ owner-packets/ d4-manifest/
│   └── ADR-014-axi-workbench-cli-m4.md
└── scripts/                            # workbench-cli-smoke.sh + cargo-publish-dry-run.sh
```

The 14 crates each carry a `Cargo.toml` + `MIGRATION.md` (13 of 14
refreshed to M9 reality per `HANDOFF.md:46`). 31 binary entry points
live under `crates/workspace-governance-rs/src/bin/` (one per
production Node script + aliases).

## Build & Install

```bash
# Local verification (per AGENTS.md:14)
cargo check --workspace
cargo test --workspace --no-fail-fast
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
cargo deny --all-features check
cargo audit --deny warnings             # currently red (11 vulns + 3 denied warnings)

# Per-crate build (per-project workbench CLI)
cargo build -p axi-workbench-cli-rs --offline
cargo test  -p axi-workbench-cli-rs --offline
cargo clippy -p axi-workbench-cli-rs --all-targets --offline

# Smoke test (per-project workbench CLI)
bash scripts/workbench-cli-smoke.sh    # 6/6 steps dual-side
```

CI: `rust-ci` workflow runs fmt / clippy / test / deny / audit on
Linux x86_64. Pre-push hook verify:

```bash
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-git-hooks.mjs verify --json
```

## Verification

```bash
# Cross-project governance
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs onboard axi-workspace-rs --json
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs handoff-check axi-workspace-rs
```

The `onboard axi-workspace-rs --json` returns readiness=verified,
score=10/10, errors=0 (post-M10 docs phase hook). `handoff-check
axi-workspace-rs` returns ok=true status=verified. The workspace
governance `workspace.json` entry for `axi-workspace-rs` lives under
`shared[]` (not `projects[]`); admission pointer is in
`admissions/axi-workspace-rs.json`; M7-CORRECTION (`docs/M7-CORRECTION.md`)
documents that `workspace.graph.json` node + `WORKSPACE_INDEX.md` row +
admission pointer in `workspace.json` are still MISSING — locked
behind D4 owner opt-in (`HANDOFF.md:587-602`).

## Architecture Highlights

**Workspace v2 + 14 crates, no root crate.** Per `Cargo.toml:1-26`:
the workspace root is metadata only (no `[package]`), members are
explicitly enumerated, shared deps live under `[workspace.dependencies]`
(28 entries), and profiles are `release` (lto=thin / codegen-units=1)
+ `dev` (debug=1). The original 13 crate migrations were committed in
`01ed7e3b`; `provider-ports-rs` was added post-M2 as the typed
provider-ports contract per ADR-014.

**Six-core SOP chain (the headline capability).** `axi-runtime-rs`
implements `SopSpec` / `SopRegistry` (DashMap + highest-version
picker, `sop.rs` ~310 LoC), `PipelineDecision` 5-state enum with
`decide()` pure function (`decision.rs` ~360 LoC),
`ExecutionPlan::from_spec()` linear step builder
(`execution_plan.rs` ~110 LoC), `CapabilityBroker` actor→grants + cap
catalog (`capability_broker.rs` ~200 LoC), `Tool` async_trait +
`ToolManager` DashMap registry (`tool_manager.rs` ~190 LoC),
`AuditEvent` + `AuditLog` DashMap (`audit.rs` ~180 LoC),
`Orchestrator::invoke()` chaining the whole stack
(`orchestrator.rs` ~540 LoC), and an axum `agent_gateway.rs` exposing
`POST /invoke` (drives the chain) and `GET /audit/{invocation_id}`
(returns the 7-event audit trail). Per `HANDOFF.md:667-714`, a demo
`demo.echo.identity` SOP produces the canonical audit log:
decision → plan → guard_permit → tool_success → guard_permit →
tool_success → sop_finished.

**Phase 1 parity-port of the Node workspace-project CLI.**
`workspace-governance-rs/src/lib.rs` (20 LoC) re-exports the four
modules (`commands`, `parser`, `registry`, `validators`); the public
types must remain **byte-stable** with the Node implementation
(lib.rs:13). The contract harness at
`tools/ctxt/contracts/workspace-governance-rs-parity/` (wired into
`pnpm workspace:contracts:test`) is the source of truth. Six
read-only subcommands (`list`, `whereami`, `health`, `onboard`,
`handoff-check`, `validate`) are exposed in Phase 1; the remaining
21 subcommands stay on Node. M7 wave parity-port brought the total
to **35 production scripts** with `cargo test -p
workspace-governance-rs` at **1078 passed / 0 failed** at M7.8 and
**1246 passed / 0 failed** after CI round-trip (`HANDOFF.md:108-110`).
The 31 bins live under `crates/workspace-governance-rs/src/bin/`,
one per production script + alias. `parser.rs` (385 LoC) is the
byte-stable schema translator with the `From<ParseError>` outer doc
comments introduced in M4 (`workspace-governance-rs/src/parser.rs:1-80`).

**Per-project `workbench` CLI (ADR-012 M4).** The
`axi-workbench-cli-rs` crate (lib.rs 7 LoC + `workspace.rs` 314 LoC +
`bin/workbench.rs` 270 LoC) implements three subcommands:
`workbench health <id>` (8-check suite from `src/checks/` —
`consumer_freshness` 128 / `contract_integrity` 119 /
`dependency_depth` 218 / `git_cleanliness` 150 / `partition_balance`
134 / `producer_health` 106 / `registry_consistency` 145 /
`tier_audit` 112 LoC, totaling 1,243 LoC), `workbench graph
[--partition --format dot|json]` (petgraph DOT emitter), and
`workbench project {list,inspect}` (`bin/workbench.rs:139-188`). The
workspace loader deliberately reads the **on-disk sources** (workspace
root `workspace.graph.json` + governance `workspace.json`) rather than
the Kernel `data/registry.json` because ADR-012 §1.4 + §2.4 declares
the Rust CLI is not coupled to the Python Kernel until ADR-011 lands
(`workspace.rs:13-19`). This makes the output byte-stable with the
governance toolchain. `tests/parity/test_rust_vs_python.py` (44
LoC) in the Python project verifies parity under `AXI_WORKBENCH_RS=1`.

**B-class owner-decision lock.** Every destructive / credential /
remote action returns `pending: *-requires-owner-opt-in` and never
auto-executes. Per `HANDOFF.md:527-545`, D1.1-D1.5 (resource
verification), D2.1-D2.4 (GitHub branch ops), D3.1-D3.5 (agent
guidance writes), D4 (registry sync `--apply`), D9 (corepack
enable), D6 + others (incubator sync / project-handoff write) all
gate on env vars (`AXI_RESOURCE_VERIFY_RUN_REMOTE=1`,
`CLOUDFLARE_API_TOKEN`, `ALIYUN_*`) or explicit flags (`--execute`,
`--apply`, `--allow-write`, `--sync`). 13 distinct B-class surfaces
locked today; each has a lib test `*_returns_remote_opt_in_lock` + a
bin test `*_returns_pending_sentinel` to prove the lock holds.

**Wave-U wasmtime cascade.** Wave-U3 (`69880d7`) closed 12/19
RUSTSEC advisories by upgrading wasmtime 10.0.2 → 24.0.13 without
touching Engine/Store/Module/Linking APIs. Wave-U3.5
(`1a67f90` on `agent/wave-u1-integrated` @ `c7f5222`, local-only)
upgrades wasmtime → 36.0.16 + MSRV 1.85 → 1.86 to close the remaining
7 advisories plus 1 unsound + 5 unmaintained. Triggered by owner
opt-in.

## Key Modules/Files

| Module / file | Responsibility | Path |
| --- | --- | --- |
| Workspace root manifest | `Cargo.toml` v2 resolver + 14 members + 28 shared deps | `Cargo.toml` |
| Per-crate SOP runtime | SOP/Decision/Plan/Broker/Tool/Audit + axum gateway | `crates/axi-runtime-rs/src/{sop,decision,execution_plan,capability_broker,tool_manager,audit,orchestrator,agent_gateway}.rs` |
| Per-crate Kernel | Envelope / ObjectKind / schema-gen / MigrationRunner | `crates/axi-kernel-rs/src/{lib,typed,schema}.rs` |
| Per-crate workspace loader | Direct read of `workspace.graph.json` + governance `workspace.json` | `crates/axi-workbench-cli-rs/src/workspace.rs` (314 LoC) |
| 8 health checks | consumer_freshness / contract_integrity / dependency_depth / git_cleanliness / partition_balance / producer_health / registry_consistency / tier_audit | `crates/axi-workbench-cli-rs/src/checks/` (9 files, 1,243 LoC) |
| `workbench` binary | clap dispatch + petgraph DOT + JSON | `crates/axi-workbench-cli-rs/src/bin/workbench.rs` (270 LoC) |
| Node CLI parity-port (lib) | registry + parser + validators + commands | `crates/workspace-governance-rs/src/{lib.rs,parser.rs,registry.rs,validators.rs,commands/*}` |
| Node CLI parity-port (bin) | 31 entry points mirroring production scripts | `crates/workspace-governance-rs/src/bin/*.rs` (31 files) |
| Provider-ports contract | typed GitHub / Cloudflare / SSH / Aliyun / Vault / Kube | `crates/provider-ports-rs/src/` |
| Event store | JSONL + chain_hash + auto-seal + TopicIndex | `crates/control-plane-event-store-rs/src/` |
| Control plane server | ServerConfig + composite health + drain auth + ReadyGate | `crates/control-plane-server-rs/src/{auth,drain,server_config,router}.rs` |
| Resource policy | typed policy + GrantLoader + ScopeSet + PolicyDecisionLog | `crates/control-plane-resource-policy-rs/src/` |
| Observability | LogRecord + W3C trace + SLI metrics + OtlpExporter + LogSampler | `crates/axi-observability-rs/src/` |
| Owner decision backlog | D1-D93 (48+ surfaces) | `docs/OWNER_DECISION_BACKLOG.md` |
| M11 BLOCKING decision record | Wave 0 close-out + multi-wave execution plan | `docs/decisions/2026-10-03-m11-blocking-decisions.md` |
| M11 spec plans | 10 per-spec impl plans | `docs/M11-specs/*.md` |
| M12+ spec plans | 5 Tier 4 picks | `docs/M12-specs/*.md` |
| Security audit | 24 vulns + 5 warnings → 11 vulns + 3 denied after Wave-U3 | `docs/SECURITY-AUDIT-2026-09-30.md` |
| Branch state | 13 → 6 branches after Phase A cleanup | `docs/BRANCH-STATE-SYNC.md` |
| Smoke script | 6/6 steps dual-side Python + Rust | `scripts/workbench-cli-smoke.sh` |
| Publish dry-run | Per-crate readiness check | `scripts/cargo-publish-dry-run.sh` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | 13 crates consolidated into monorepo (commit `01ed7e3b`) | Done 2026-09-29 |
| M1.1 | cargo check 0 error + 104/104 cargo test green | Done 2026-09-29 |
| M2 | SOP → Decision → Plan → Broker → Tool → Audit closed loop | Done 2026-09-29 (148 tests) |
| M3 | workspace-governance-rs SOP bridge | Done 2026-09-29 (153 tests) |
| M4 | Governance registration + per-project workbench CLI landed | Done 2026-09-29 / 2026-10-03 |
| M5 | clippy 0 warnings | Done 2026-09-29 (155 tests) |
| M6 | 21 Node-only subcommand parity-port | Done 2026-09-29 (~318 tests) |
| M7 | 35 production Node script parity-port | Done 2026-09-30 (1,246 tests) |
| M7.5 | D4 registry integration | Half-done; locked behind owner opt-in |
| M7.8 | registry path bug fixed + 8 CI rounds | Done 2026-09-30 (1,246 tests) |
| M8.x | Cross-crate wave (8 sub-waves; 1,738 → 2,657 tests) | Done 2026-10-02 |
| M9 | Final cross-crate parity-port (10 modules) | Done 2026-10-02 (2,816 tests) |
| Wave-U3 | wasmtime 10 → 24.0.13 (12/19 advisories) | Done 2026-09-30 |
| M10 docs phase | 25 specs / 7,253 LoC under `docs/M10-specs/` + 30 sub-agent outputs | Done 2026-10-02 |
| M11+ follow-up planning | 13 docs / ~3,800 LoC / 24 D-IDs (D44-D67) | Done 2026-10-03 |
| M12+ prep planning | 13 docs / ~5,400 LoC / 26 D-IDs (D68-D93) | Done 2026-10-03 |
| M11 BLOCKING decisions | 8 BLOCKING + D43 accepted; D44-D67 + D68-D93 deferred | Accepted 2026-10-03 |
| M11 Tier 1 implementation | 5 specs (PROV-013 / CP-EVT-008 / CP-SRV-004 / KRN-005 / SYN-005) across 4 impl branches | Done 2026-10-03 (2,943 tests) |
| rustfmt remediation | 3 nightly-only options removed + 73 files reformatted | Done 2026-10-03 (fmt gate green) |
| CP-RP-006 / OBS-014 / CP-VW-005 / INB-002 / CP-OUT-005 | planned-only (impl plans ready, awaiting impl wave) | Pending |
| Wave-U3.5 | wasmtime 24 → 36.0.16 + MSRV 1.85 → 1.86 | Staged locally on `agent/wave-u1-integrated`; owner-triggered |
| Linux CI first run | GitHub Actions `rust-ci` on Linux x86_64 | Pending push |
| M12+ implementation | 26 D-IDs deferred to M12.0 / M12.5 / M12.6+ | Default = defer all |

Recent commit trajectory (`git log --oneline -25`, last entries):

```
70c1e43 docs(axi-workspace-rs): add MIGRATION-SESSION-SUMMARY-2026-10-03.md
54f1331 docs(axi-workspace-rs): add Python CLI retirement plan (post-M4 future work per ADR-012 §4.4)
70fdcaf docs(axi-workspace-rs): scrub milestone-singular errors in our own docs
3eb18b6 chore(axi-workspace-rs): add cargo-publish-dry-run script
7fc3ba4 docs(CAPABILITY-INVENTORY): add 3-monorepo mirror table
3e3efac docs(axi-workspace-rs): add 3-monorepo deep parity report (post-M4)
9825fe3 docs(axi-workspace-rs): add 3-monorepo cross-check report (post-M4)
1e46a52 docs(axi-workspace-rs): add M4-CLOSEOUT.md
cb3b827 docs(axi-workspace-rs): add ADR-014 workbench-cli M4 pointer
a260033 chore(axi-workspace-rs): extend workbench-cli-smoke.sh with Python CLI 6th step
8790fdc ci(axi-workspace-rs): add workbench-cli-smoke step
9a2dfea style(axi-workbench-cli-rs): apply rustfmt to smoke test files
1e0e303 docs(CHANGELOG): append M4 Rust migration consolidation entry (2026-10-03)
9905628 chore(axi-workspace-rs): cross-workspace consistency check
91f2ecb chore(axi-workspace-rs): invoke workbench-cli-smoke.sh from post-commit hook
6bfd1e3 docs(axi-workspace-rs): patch HANDOFF.md to reflect per-project workbench CLI (M4 landed)
571d72b docs(axi-workspace-rs): retire RUST-MIG-CLI-001..010 refs after M4
378e431 feat(axi-workbench-cli-rs): land per-project workbench CLI (ADR-012 M4)
0a4f915 docs(axi-workspace-rs): M11 Tier 1 Wave 0-3 acceptance — 5 specs implemented
8f470d7 style(axi-workspace-rs): mechanical reformat to stable rustfmt defaults
da98aa0 chore(axi-workspace-rs): strip 3 nightly-only rustfmt options
```

Working tree: branch `agent/install-git-hooks`, **223 ahead-of-origin**, dirty `docs/OWNER_DECISION_BACKLOG.md` + `docs/designs/2026-10-03-clippy-toml-lint-proposal.md` + `docs/designs/2026-10-03-rustfmt-nightly-remediation.md` + 19 untracked submit logs.

## Authoritative Documents

- [`README.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/README.md) — 14-crate table + verification commands + status
- [`HANDOFF.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/HANDOFF.md) — 26.4k-token handoff (M1-M11 + Wave-U3 + M11 Wave 1)
- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/AGENTS.md) — Lore Commit Protocol + 5 trailer constraints + verification commands
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/CHANGELOG.md) — M4 Rust migration consolidation entry
- [`Cargo.toml`](/Volumes/code/workspace/foundation/axi-workspace-rs/Cargo.toml) — workspace v2 + 14 members + 28 shared deps
- [`docs/OWNER_DECISION_BACKLOG.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/OWNER_DECISION_BACKLOG.md) — D1-D93 owner decision surface
- [`docs/MIGRATION-MATRIX.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/MIGRATION-MATRIX.md) — RUST-MIG-* cross-crate migration
- [`docs/CAPABILITY-INVENTORY.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/CAPABILITY-INVENTORY.md) — capability map per crate
- [`docs/M10-specs/00-OWNER-PACKET-V2.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/M10-specs/) — 48 owner decisions across 7 tiers
- [`docs/M11-specs/`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/M11-specs/) — 10 per-spec implementation plans
- [`docs/M12-specs/`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/M12-specs/) — 5 Tier 4 picks
- [`docs/decisions/2026-10-03-m11-blocking-decisions.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/decisions/) — Wave 0 close-out
- [`docs/SECURITY-AUDIT-2026-09-30.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/SECURITY-AUDIT-2026-09-30.md) — CVSS + upgrade path
- [`docs/BRANCH-STATE-SYNC.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/BRANCH-STATE-SYNC.md) — branch state + cargo audit
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/VERIFICATION.md) — gate matrix
- [`docs/M7-WAVE-CONSOLIDATION.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/M7-WAVE-CONSOLIDATION.md) — 14-commit M7 chain
- [`docs/M7-CORRECTION.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/M7-CORRECTION.md) — D4 half-state honesty record
- [`docs/M4-CLOSEOUT.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/M4-CLOSEOUT.md) — M4 9-section summary
- [`docs/ADR-014-axi-workbench-cli-m4.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/docs/ADR-014-axi-workbench-cli-m4.md) — ADR-014 ↔ M4 cross-link
- [`crates/<each>/MIGRATION.md`](/Volumes/code/workspace/foundation/axi-workspace-rs/crates/) — 13 per-crate MIGRATION.md refreshed to M9 reality

## Cross-References

This repo **provides** (per `workspace.json` shared tier, `compliance_profile: rust-monorepo`):

- `axi-workspace-rs` capability surfaced as 6 modules: SOP Kernel / Decision Engine / Capability Broker / Agent Runtime / Event Runtime / Audit Runtime
- 14 crates exposed as installable targets under the local Verdaccio registry
- `workbench` binary (per-project CLI at `target/debug/workbench`)
- 31 governance CLI bins under `crates/workspace-governance-rs/src/bin/`
- A-class Node parity-port (read-only) at `crates/workspace-governance-rs`

This repo **consumes** (declared in `workspace.json`):

- `axi-kernel` (`foundation/axi-kernel`) — PRD-01 Kernel object registry
- `axi-rules` (`foundation/axi-rules`) — rule router + Lore Commit Protocol
- `axi-agent` (`agent-cluster/axi-agent`) — Agent runtime (Phase 3+)
- `axi-pet-desktop` and other axiom platform components

Sister projects:

- `foundation/workspace-governance` — Node parent of `workspace-governance-rs` (Phase 1 byte-stable parity target)
- `foundation/axi-workbench-cli` — Python parent of `axi-workbench-cli-rs` (M4 retirement path documented in `docs/PYTHON-CLI-RETIREMENT.md`)
- `workbench/axi-workbench/services/api-gateway` — original home of `api-gateway-rs`
- `workbench/axi-workbench/services/control-plane` — original home of all 5 `control-plane-*-rs` crates
- `foundation/axi-observability/rust/axi-observability-rs` — original home of `axi-observability-rs`

The canonical CLI entrypoint for downstream tools is
`/Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench`
(per `foundation/axi-workbench-cli/AGENTS.md:54-58` and
`foundation/axi-workbench-cli/cli/axi_workbench/rs_shim.py:26-28`).

## Notes

- 14 crates consolidated into monorepo per ADR-010 / ADR-012; Phase 1 byte-stable parity with Node `workspace-project` CLI.
- Working tree on `agent/install-git-hooks` is 223 ahead-of-origin (2026-10-07 snapshot).
- M11 BLOCKING owner decisions accepted 2026-10-03; Phase 2-4 of parity-port deferred behind D4 owner opt-in.