---
id: axi-docs-zh-projects-axi-workspace-rs
title: Axi 工作区 Rust 单一仓库
type: project
status: published
tags: [Axi Docs, 项目, foundation, rust, governance, monorepo, sop, kernel, runtime]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi 工作区 Rust 单一仓库
graph-tags: [Foundation, Rust, Governance]
description: 14 个 crate 的 Rust 单一仓库，按 ADR-010 交付 Axi 治理后端（SOP 内核、决策引擎、能力代理、Agent Runtime、Event/Audit、Provider Ports）。包含 workspace-project 的 Rust 移植以及每项目的 workbench CLI（ADR-012 M4）。
project:
  id: axi-workspace-rs
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-workspace-rs
  source-section: shared
---

# Axi 工作区 Rust 单一仓库

> 权威源：
> [`/Volumes/code/workspace/foundation/axi-workspace-rs/`](/Volumes/code/workspace/foundation/axi-workspace-rs/)。
> 章节：shared / 分区：`foundation/`。

## Summary

Axi 工作区 Rust 单一仓库是 **Axi 治理后端的规范化 Rust 实现**，由 ADR-010 治理并由 ADR-011..019 锚定。其 `Cargo.toml` `[workspace] members` 枚举了 **14 个 crate**（由 `01ed7e3b` 整合 + M4 后新增 `provider-ports-rs` 解出）：`axi-kernel-rs`、`axi-workbench-cli-rs`、`axi-runtime-rs`、`axi-sync-rs`、`axi-inbox-rs`、`workspace-governance-rs`、`api-gateway-rs`、`control-plane-event-store-rs`、`control-plane-outbox-rs`、`control-plane-resource-policy-rs`、`control-plane-view-registry-rs`、`control-plane-server-rs`、`axi-observability-rs`、`provider-ports-rs`（`Cargo.toml:3-18`）。每个 crate 都从其原项目位置迁移而来，源端 `src-rs/<crate>` 目录在同一次提交中从原项目里被删除。

本单一仓库是 Node `workspace-project` CLI 只读子集（Phase 1）和 Python `axi-workbench-cli` 完整 CLI 面（ADR-012 的 M1-M4）背后的运行时交付物。头条能力链——`SOP → Decision → ExecutionPlan → Guard → Tool → Audit`——位于 `axi-runtime-rs`（`HANDOFF.md:62-65`）；`workspace-governance-rs` crate 持有 35 个生产 Node 脚本的 parity 移植；`axi-workbench-cli-rs`（M4 于 2026-10-03 commit `378e431` 落地）提供 `workbench {health,graph,project}` 二进制，位于 `target/debug/workbench`。`provider-ports-rs` crate 持有 GitHub/Cloudflare/SSH/Aliyun 的类型化 provider-ports 契约。

**当前状态（HEAD `8f470d7`，分支 `agent/install-git-hooks`，领先 origin 223 次提交，M11 Wave 1 验收于 2026-10-03）**：`cargo test --workspace` **2943 通过 / 0 失败**（2816 → M11 Wave 1 四条轨道 +127），`cargo clippy --workspace --all-targets -- -D warnings` **0 错误**，`cargo fmt --all --check` **绿色**（rustfmt nightly-config 修复 `da98aa0`+`8f470d7` 自 M7.1 以来首次让门禁回到绿色）。`cargo deny` 公告 FAIL = 预先存在（RUSTSEC-2025-0020 pyo3 0.21.2 + 已撤回 yoke-derive）。M11 Wave 1 落地了 5 个 spec（PROV-013 Vault D14/D15、CP-EVT-008 D16/D17、CP-SRV-004 D22/D23、KRN-005+SYN-005 D29/D33），跨 4 个并行 impl 分支，全部以 `--no-ff` 合并到 `agent/install-git-hooks`。

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

14 个 crate 各携带 `Cargo.toml` + `MIGRATION.md`（13/14 刷新到 M9 现实，见 `HANDOFF.md:46`）。31 个二进制入口位于 `crates/workspace-governance-rs/src/bin/` 下（每个生产 Node 脚本 + 别名各一）。

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

CI：`rust-ci` 工作流在 Linux x86_64 上跑 fmt / clippy / test / deny / audit。Pre-push hook 校验：

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

`onboard axi-workspace-rs --json` 返回 readiness=verified、score=10/10、errors=0（M10 docs phase hook 之后）。`handoff-check axi-workspace-rs` 返回 ok=true status=verified。工作区治理 `workspace.json` 中 `axi-workspace-rs` 条目位于 `shared[]`（而非 `projects[]`）；准入指针在 `admissions/axi-workspace-rs.json`；M7-CORRECTION（`docs/M7-CORRECTION.md`）记录了 `workspace.graph.json` 节点 + `WORKSPACE_INDEX.md` 行 + `workspace.json` 中的准入指针仍 MISSING —— 锁定在 D4 owner opt-in 之后（`HANDOFF.md:587-602`）。

## Architecture Highlights

**Workspace v2 + 14 个 crate，无根 crate。** 据 `Cargo.toml:1-26`：工作区根仅为元数据（无 `[package]`），成员显式枚举，共享依赖位于 `[workspace.dependencies]`（28 项），profile 为 `release`（lto=thin / codegen-units=1）+ `dev`（debug=1）。原 13 个 crate 迁移提交于 `01ed7e3b`；`provider-ports-rs` 在 M2 之后按 ADR-014 添加，作为类型化 provider-ports 契约。

**六核 SOP 链（头条能力）。** `axi-runtime-rs` 实现 `SopSpec` / `SopRegistry`（DashMap + 最高版本挑选，`sop.rs` ~310 LoC）、`PipelineDecision` 5 状态枚举及 `decide()` 纯函数（`decision.rs` ~360 LoC）、`ExecutionPlan::from_spec()` 线性步骤构造器（`execution_plan.rs` ~110 LoC）、`CapabilityBroker` actor→grants + cap 目录（`capability_broker.rs` ~200 LoC）、`Tool` async_trait + `ToolManager` DashMap 注册表（`tool_manager.rs` ~190 LoC）、`AuditEvent` + `AuditLog` DashMap（`audit.rs` ~180 LoC）、`Orchestrator::invoke()` 串接整个栈（`orchestrator.rs` ~540 LoC），以及 axum `agent_gateway.rs` 暴露 `POST /invoke`（驱动该链）与 `GET /audit/{invocation_id}`（返回 7 事件审计追踪）。据 `HANDOFF.md:667-714`，demo `demo.echo.identity` SOP 产出规范化审计日志：decision → plan → guard_permit → tool_success → guard_permit → tool_success → sop_finished。

**Node workspace-project CLI 的 Phase 1 parity 移植。** `workspace-governance-rs/src/lib.rs`（20 LoC）重新导出四个模块（`commands`、`parser`、`registry`、`validators`）；公共类型必须与 Node 实现保持**字节稳定**（lib.rs:13）。契约 harness 位于 `tools/ctxt/contracts/workspace-governance-rs-parity/`（接入 `pnpm workspace:contracts:test`），是权威源。Phase 1 暴露 6 个只读子命令（`list`、`whereami`、`health`、`onboard`、`handoff-check`、`validate`）；其余 21 个子命令保留在 Node 上。M7 wave parity 移植将总数推到 **35 个生产脚本**，`cargo test -p workspace-governance-rs` 在 M7.8 时为 **1078 通过 / 0 失败**，CI 往返后为 **1246 通过 / 0 失败**（`HANDOFF.md:108-110`）。31 个 bin 位于 `crates/workspace-governance-rs/src/bin/` 下，每个生产脚本 + 别名各一。`parser.rs`（385 LoC）是字节稳定的 schema 翻译器，M4 引入了 `From<ParseError>` 外层文档注释（`workspace-governance-rs/src/parser.rs:1-80`）。

**每项目 `workbench` CLI（ADR-012 M4）。** `axi-workbench-cli-rs` crate（lib.rs 7 LoC + `workspace.rs` 314 LoC + `bin/workbench.rs` 270 LoC）实现三个子命令：`workbench health <id>`（来自 `src/checks/` 的 8 项检查套件——`consumer_freshness` 128 / `contract_integrity` 119 / `dependency_depth` 218 / `git_cleanliness` 150 / `partition_balance` 134 / `producer_health` 106 / `registry_consistency` 145 / `tier_audit` 112 LoC，合计 1,243 LoC）、`workbench graph [--partition --format dot|json]`（petgraph DOT 输出器），以及 `workbench project {list,inspect}`（`bin/workbench.rs:139-188`）。工作区加载器刻意读取**磁盘源**（工作区根 `workspace.graph.json` + governance `workspace.json`），而不是 Kernel `data/registry.json`，因为 ADR-012 §1.4 + §2.4 声明 Rust CLI 在 ADR-011 落地之前不与 Python Kernel 耦合（`workspace.rs:13-19`）。这使输出与治理工具链字节稳定。Python 项目内的 `tests/parity/test_rust_vs_python.py`（44 LoC）在 `AXI_WORKBENCH_RS=1` 下校验 parity。

**B 类所有者决策锁。** 每个破坏性 / 凭证 / 远程动作都返回 `pending: *-requires-owner-opt-in` 且永不自动执行。据 `HANDOFF.md:527-545`，D1.1-D1.5（资源校验）、D2.1-D2.4（GitHub 分支操作）、D3.1-D3.5（agent 指引写入）、D4（registry sync `--apply`）、D9（corepack 启用）、D6 + 其他（incubator 同步 / 项目交接写入）都门控在环境变量（`AXI_RESOURCE_VERIFY_RUN_REMOTE=1`、`CLOUDFLARE_API_TOKEN`、`ALIYUN_*`）或显式标志（`--execute`、`--apply`、`--allow-write`、`--sync`）之上。当今锁定 13 个不同的 B 类面；每个都有 lib 测试 `*_returns_remote_opt_in_lock` 与 bin 测试 `*_returns_pending_sentinel` 以证明锁有效。

**Wave-U wasmtime 级联。** Wave-U3（`69880d7`）通过将 wasmtime 从 10.0.2 升级到 24.0.13（不触碰 Engine/Store/Module/Linking API）关闭了 12/19 RUSTSEC 公告。Wave-U3.5（`agent/wave-u1-integrated` 上的 `1a67f90`，@ `c7f5222`，仅本地）将 wasmtime 升级到 36.0.16，MSRV 1.85 升级到 1.86，以关闭剩余 7 项公告 + 1 项 unsound + 5 项 unmaintained。由 owner opt-in 触发。

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

工作树：分支 `agent/install-git-hooks`，**领先 origin 223 次提交**，dirty `docs/OWNER_DECISION_BACKLOG.md` + `docs/designs/2026-10-03-clippy-toml-lint-proposal.md` + `docs/designs/2026-10-03-rustfmt-nightly-remediation.md` + 19 个未跟踪的 submit log。

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

本仓库**提供**（据 `workspace.json` shared tier，`compliance_profile: rust-monorepo`）：

- `axi-workspace-rs` capability 暴露为 6 个模块：SOP Kernel / Decision Engine / Capability Broker / Agent Runtime / Event Runtime / Audit Runtime
- 14 个 crate 作为可安装目标暴露在本地 Verdaccio 注册表下
- `workbench` 二进制（每项目 CLI，位于 `target/debug/workbench`）
- 31 个治理 CLI bin，位于 `crates/workspace-governance-rs/src/bin/` 下
- A 类 Node parity 移植（只读），位于 `crates/workspace-governance-rs`

本仓库**消费**（在 `workspace.json` 中声明）：

- `axi-kernel` (`foundation/axi-kernel`) — PRD-01 Kernel 对象注册表
- `axi-rules` (`foundation/axi-rules`) — 规则路由器 + Lore Commit Protocol
- `axi-agent` (`agent-cluster/axi-agent`) — Agent runtime（Phase 3+）
- `axi-pet-desktop` 与其他 axiom 平台组件

姐妹项目：

- `foundation/workspace-governance` — `workspace-governance-rs` 的 Node 父项（Phase 1 字节稳定 parity 目标）
- `foundation/axi-workbench-cli` — `axi-workbench-cli-rs` 的 Python 父项（M4 退役路径记录在 `docs/PYTHON-CLI-RETIREMENT.md`）
- `workbench/axi-workbench/services/api-gateway` — `api-gateway-rs` 的原所在地
- `workbench/axi-workbench/services/control-plane` — 所有 5 个 `control-plane-*-rs` crate 的原所在地
- `foundation/axi-observability/rust/axi-observability-rs` — `axi-observability-rs` 的原所在地

下游工具的规范化 CLI 入口是
`/Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench`
（据 `foundation/axi-workbench-cli/AGENTS.md:54-58` 与
`foundation/axi-workbench-cli/cli/axi_workbench/rs_shim.py:26-28`）。

## 说明

- 14 个 crate 按 ADR-010 / ADR-012 整合入单一仓库；Phase 1 与 Node `workspace-project` CLI 字节稳定的 parity。
- 工作树在 `agent/install-git-hooks` 上领先 origin 223 次提交（2026-10-07 快照）。
- M11 BLOCKING 所有者决策于 2026-10-03 接纳；Phase 2-4 的 parity 移植推迟至 D4 owner opt-in 之后。