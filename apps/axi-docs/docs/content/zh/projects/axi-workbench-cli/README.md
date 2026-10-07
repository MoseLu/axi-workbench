---
id: axi-docs-zh-projects-axi-workbench-cli
title: Axi Workbench CLI (Python)
type: project
status: published
tags: [Axi Docs, 项目, foundation, python, governance-cli, kernel, scanner, dashboard, health-checks]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench CLI
graph-tags: [Foundation, Python, Governance]
description: AXI Personal OS Workbench 的规范化 Python CLI（PRD-02）。扫描工作区、运行每项目 8 项健康检查、发出 DOT/JSON 图与仪表板、暴露 §7 度量原语。基于 PRD-01 Kernel（通过运行时 sys.path 插入）。每项目的 Rust 移植位于 `foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/`。
project:
  id: axi-workbench-cli
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-workbench-cli
  source-section: shared
---

# Axi Workbench CLI（Python）

> 权威源：
> [`/Volumes/code/workspace/foundation/axi-workbench-cli/`](/Volumes/code/workspace/foundation/axi-workbench-cli/)。
> 章节：shared / 分区：`foundation/`。

## Summary

Axi Workbench CLI 是 **AXI Personal OS Workbench 的规范化 Python 治理 CLI**（PRD-02）。它扫描工作区、按置信度对候选项目打分、一次性原子地将已接纳的候选项目注册进 PRD-01 Kernel、对每个注册项目运行 8 项健康检查、发出关系图（DOT + JSON），将 Kernel 中声明的关系与推断出的 AGENTS.md 交叉引用组合在一起、按类型/阶段/技术栈暴露仪表板，并暴露 PRD-02 §7 的 `bench` 度量原语。

Python 实现是 **PRD-01 Kernel 之上的薄层**（`foundation/axi-kernel`）：`cli/axi_workbench/kernel_bridge.py` 里的运行时 `sys.path` 插入通过从 CLI 文件向上回溯查找 `incubator/object-registry/axi_kernel` 来解析 Kernel 包，优先使用规范化路径 `/Volumes/code/workspace/foundation/axi-kernel`，并以 `AXI_KERNEL_PATH` 环境变量作为最终回退（`kernel_bridge.py:25-49`）。它是**纯 CLI**（按 PRD-02 §5 无 Web UI）、**默认只读**（仅 `confirm` 写入 Kernel）、**owner-internal**（据 `pyproject.toml:11-15` 不发布到公共索引）。

**双入口 shim**（`cli/axi_workbench/rs_shim.py:42-83`）让运维人员在不改变用户命令行的情况下，通过 `AXI_WORKBENCH_RS=1` 在 `health` / `graph` / `project` 子命令上选择规范化 Rust 二进制 `/Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench`（`rs_shim.py:11-16`）。这在 commit `a39352f` 中作为 M4 Rust 迁移整合（ADR-012 §4.4）的一部分加入。

**当前状态**：分支 `dev`（领先 origin 15，落后 1），M2/M3/M4 Rust 迁移整合于 2026-10-03 完成（commit `f4ce80b` CHANGELOG 条目）；`tests/test_workbench.py` 31 项测试；新 parity 测试 `tests/parity/test_rust_vs_python.py`（44 LoC）于 2026-10-03（`925774b`）添加，覆盖 `AXI_WORKBENCH_RS=1` 实时 shim。PRD 于 2026-09-27 升级到 v1.1 模板（`d73dd5f`）。`foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/` Rust 移植按 ADR-012 §5 Phase M4 持有规范化 CLI；本 Python 仓库是 M4 后续推广期间的面向消费者的界面。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Runtime | Python ≥ 3.11 (`pyproject.toml:6`) | Standalone CLI; no Web framework |
| Build | `pyproject.toml` minimal (PEP 621), pytest discover `tests` | `pyproject.toml:1-19` |
| Test framework | stdlib `unittest` (no pytest) | 31 tests + parity suite |
| Optional observability | `axi_observability.logging.{scope,setup}` fallback to `print(..., file=sys.stderr)` | `__main__.py:89-100` |
| Kernel bridge | `sys.path.insert(0, ...)` at import time, no `pip install` | `cli/axi_workbench/kernel_bridge.py:52-54` |
| Graph emission | Hand-written DOT emitter (Python) + petgraph (Rust port) | `cli/axi_workbench/graph.py` 185 LoC |
| Rust shim | `subprocess.run([DEFAULT_RUST_BINARY, *argv])` opt-in via env | `cli/axi_workbench/rs_shim.py:42-83` |
| Distribution | Owner-internal; not on PyPI | `pyproject.toml:11-15` |
| Docs format | Markdown (`AGENTS.md`, `README.md`, `README.zh-CN.md`, `PRD.md`, `docs/HANDOFF.md`, `docs/VERIFICATION.md`) | Per PRD-02 §7 |
| Workflows | CLI-ONBOARD-001 / CLI-TRIAGE-001 / CLI-HEALTH-001 | `docs/workflows/` |
| ADRs | ADR-012 Rust migration + §5 closeout | `docs/adr/` |

## Project Layout

```text
axi-workbench-cli/
├── pyproject.toml                      # PEP 621, name=axi-workbench-cli v0.1.0
├── AGENTS.md                           # Read order + boundaries + verification
├── README.md / README.zh-CN.md         # Quick start + layout
├── PRD.md                              # v1.1 template, 14 sections, FR-1..FR-9
├── CHANGELOG.md                        # Keep a Changelog, [Unreleased] + rounds
├── CHANGE.md                           # Behavior-affecting changes (single 2026-09-21 entry)
├── TODO.md / MILESTONE.md              # M1 active, M2/M3 pending
├── docs/
│   ├── HANDOFF.md                      # Zero-context takeover brief (generated)
│   ├── VERIFICATION.md                 # Gate matrix for AC-1..AC-9
│   ├── M4-POSTMORTEM.md                # 2026-10-03 Rust migration post-mortem
│   ├── adr/ADR-012-workbench-cli-rust-migration.md
│   ├── adr/ADR-012-section-5-closeout.md
│   ├── logs/
│   ├── project-docs.manifest.json
│   └── workflows/                      # CLI-ONBOARD-001 / CLI-TRIAGE-001 / CLI-HEALTH-001
├── cli/axi_workbench/                  # Public Python package
│   ├── __init__.py                     # 24 LoC
│   ├── __main__.py                     # 392 LoC, CLI entrypoint with Rust delegation
│   ├── kernel_bridge.py                # 78 LoC, sys.path injection
│   ├── onboarding.py                   # 251 LoC, confirm/reject/correct
│   ├── dashboard.py                    # 277 LoC, summary/list/inspect/blocked/recent/pending/tech-stack/context-pack
│   ├── graph.py                        # 185 LoC, DOT + JSON + declared-uses writer
│   ├── inferrer.py                     # 230 LoC, stage/tech_stack/doc_type inference
│   ├── bench.py                        # 203 LoC, §7 measurement harness
│   ├── rs_shim.py                      # 83 LoC, AXI_WORKBENCH_RS=1 dual-entry
│   ├── checks/                         # 8 health checks (per PRD-02 §4 W4)
│   │   ├── __init__.py                 # 80 LoC, runner
│   │   ├── base.py                     # 15 LoC, CheckResult dataclass
│   │   ├── readme.py                   # 24 LoC
│   │   ├── handoff.py                  # 28 LoC
│   │   ├── startup_command.py          # 68 LoC
│   │   ├── verify_command.py           # 68 LoC
│   │   ├── git_status.py               # 68 LoC
│   │   ├── registered.py               # 50 LoC
│   │   ├── high_impact.py              # 55 LoC
│   │   └── tests_dir.py                # 59 LoC
│   └── scanner/
│       ├── __init__.py                 # 26 LoC
│       ├── partition.py                # 63 LoC, partition traversal
│       └── candidate.py                # 142 LoC, candidate scoring
├── tests/
│   ├── __init__.py
│   ├── conftest.py                     # Cross-project sys.path setup
│   ├── test_workbench.py               # 609 LoC, 31 tests
│   └── parity/
│       ├── __init__.py
│       ├── runner.py                   # Byte-parity harness
│       └── test_rust_vs_python.py      # 44 LoC, AXI_WORKBENCH_RS=1 live shim test
├── evidence/                           # Captured CLI outputs (PRD-02 AC evidence)
│   ├── bench.log
│   ├── context-pack-*.log
│   ├── parity/
│   │   ├── PARITY-postm4-2026-10-03.md # Post-M4 parity report
│   │   └── parity_rows.json            # Row-level parity data
│   ├── scan-projects.log
│   ├── declared-relations-self-check.log
│   ├── onboarding.log
│   └── health-axi-rules.log
└── scripts/
    └── python-cli-smoke.sh             # 17 LoC, --help / scan / summary smoke
```

Python 源码合计 3,078 LoC，22 个文件（据 `cli/axi_workbench/*.py` + `cli/axi_workbench/{checks,scanner}/*.py` + `tests/test_workbench.py` 的 `wc -l`）。

## Build & Install

无 `pip install` 步骤。本包为 owner-internal（`pyproject.toml:11-15`）。

```bash
# Smoke (per AGENTS.md:51-65)
PYTHONPATH=cli:/Volumes/code/workspace/foundation/axi-kernel:/Volumes/code/workspace/foundation/axi-rules \
  python3 -m axi_workbench --help

# Unit tests (31 tests)
PYTHONPATH=cli:/Volumes/code/workspace/foundation/axi-kernel:/Volumes/code/workspace/foundation/axi-rules \
  python3 -m unittest discover -s tests -v

# Parity test against Rust port (under AXI_WORKBENCH_RS=1)
PYTHONPATH=cli:/Volumes/code/workspace/foundation/axi-kernel \
  python3 -m unittest tests.parity.test_rust_vs_python -v

# Smoke script
bash scripts/python-cli-smoke.sh   # --help / scan / summary
```

规范化 Rust 二进制路径在 `rs_shim.py:26-28` 中硬编码：

```python
DEFAULT_RUST_BINARY = (
    "/Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench"
)
```

## Verification

据 `AGENTS.md:49-77`：

```bash
# Canonical Rust binary (post-M4)
ls -la /Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench
cargo build --manifest-path /Volumes/code/workspace/foundation/axi-workspace-rs/Cargo.toml \
  -p axi-workbench-cli-rs --offline
cargo test  --manifest-path /Volumes/code/workspace/foundation/axi-workspace-rs/Cargo.toml \
  -p axi-workbench-cli-rs --offline
cargo clippy --manifest-path /Volumes/code/workspace/foundation/axi-workspace-rs/Cargo.toml \
  -p axi-workbench-cli-rs --all-targets --offline
bash /Volumes/code/workspace/foundation/axi-workspace-rs/scripts/workbench-cli-smoke.sh

# Python CLI
PYTHONPATH=cli:/Volumes/code/workspace/foundation/axi-kernel:/Volumes/code/workspace/foundation/axi-rules \
  python3 -m unittest discover -s tests -v
PYTHONPATH=cli:/Volumes/code/workspace/foundation/axi-kernel \
  python3 -m axi_workbench --help
PYTHONPATH=cli:/Volumes/code/workspace/foundation/axi-kernel \
  python3 -m unittest tests.parity.test_rust_vs_python -v

# Workspace governance
node /Volumes/code/workspace/scripts/workspace-project validate
```

通过准则：`python3 -m unittest` 0 失败；`workspace-project validate` clean exit；`cargo test` 26+ passing tests（`AGENTS.md:78-80`）。

## Architecture Highlights

**四层架构（PRD-02 §2）。** 代码库清晰地映射到 4 个单向层：**L0** `kernel_bridge.py` 将 `axi_kernel` 注入 `sys.path`，缺失则抛 `exit 3`（`kernel_bridge.py:46-49`）；**L1** `onboarding.py` 读取工作区分区并通过 `register_many` 写入 Kernel（幂等）；**L2** `dashboard.py` + `graph.py` + `checks/` 交付治理视图（8 项健康检查、dot/json 图、summary/inspect/blocked/recent/pending/tech-stack/context-pack）；**L3** `__main__.py` 分派 CLI 子命令。据 PRD-02 §2.1，依赖只向下流动；反向引用 = 分层违规。

**8 项健康检查（PRD-02 §4 W4）。** 在 `cli/axi_workbench/checks/__init__.py:32-41` 中按确定性顺序注册：`readme`（24 LoC）/ `handoff`（28 LoC）/ `startup-command`（68 LoC）/ `verify-command`（68 LoC）/ `git-status`（68 LoC，按 `git_status.py:18` 接受 `main|dev|agent/.*|feat/.*|fix/.*|chore/.*|release/.*`）/ `registered`（50 LoC）/ `high-impact-changes`（55 LoC）/ `tests`（59 LoC）。每个返回带 `ok/warn/fail` 状态 + `evidence_path` + `reason` + `detail`（后者用于可操作的调试）的 `CheckResult`。运行器（`__init__.py:44-74`）隔离每次检查的异常，因此单项失败不会让整套崩溃。

**默认只读 + 显式 confirm。** 除非运维人员显式调用 `confirm --candidates <file> --ids <csv>`，否则 CLI 永不写入 Kernel；其他所有子命令都是只读的。`onboarding.py:53-80` 从候选构建 `ProjectObject`，通过 `correct` 遵循 `corrected_*` 覆写，调用 `register_many` 进行原子写入，并为 Change Sync 消费者持久化 `Workbench Change` 事件（`CHANGELOG.md:13-19`）。对已注册项目的重新确认是幂等的。

**AXI_WORKBENCH_RS 双入口 shim。** `rs_shim.py:31-39` 从环境读取 `AXI_WORKBENCH_RS`（除 `"1"` 之外任何值都关闭）；`run_via_rust(argv)` 通过子进程调用规范化 Rust 二进制，逐字转发 `argv`（无参数翻译）。如果二进制缺失，shim 抛 `RuntimeError` 而不是静默回退，因此错误配置会在 M4 后续推广早期就显形（`rs_shim.py:70-75`）。今天 Rust 移植实现了 `health` / `graph` / `project list|inspect`；其他所有内容落到 Python。

**声明关系自动推断。** `inferrer._declared_dependencies()` 走查 `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`，按工作区模式（`axi-...`、`ielts-vocab`、`story-graph`）拉取名字。`graph.write_declared_uses()` + CLI `relate` 幂等地从清单声明的依赖写入 `Relation(kind=USES)` 边到注册项目 ID（`CHANGELOG.md:30-46`）。实时工作区当前没有声明内部依赖，因此真实数据上的 `declared_count` 为 0 —— 流水线通过沙箱自检来执行。

**§7 度量 harness。** `bench.py`（203 LoC）实现三个指标：`onboarding-time`、`lookup-time`、`correction-rate`。输出写入 `evidence/bench.log` 文件（`evidence/` 中来自 2026-09-20 第 1 轮与第 2 轮的多次捕获）。

## Key Modules/Files

| Module / file | Responsibility | Path |
| --- | --- | --- |
| CLI entrypoint | argparse dispatch + Rust delegation + observability scope | `cli/axi_workbench/__main__.py` (392 LoC) |
| L0 kernel bridge | `sys.path.insert(0, ...)` for PRD-01 Kernel; env override | `cli/axi_workbench/kernel_bridge.py` (78 LoC) |
| L1 onboarding | confirm / reject / correct; idempotent `register_many`; Change event emit | `cli/axi_workbench/onboarding.py` (251 LoC) |
| L2 dashboard | summary / list / inspect / blocked / recent / pending / tech-stack / context-pack | `cli/axi_workbench/dashboard.py` (277 LoC) |
| L2 graph emitter | DOT (Graphviz-valid) + JSON + declared-uses writer | `cli/axi_workbench/graph.py` (185 LoC) |
| Inferrer | stage / tech_stack / doc_type / declared-dep heuristics | `cli/axi_workbench/inferrer.py` (230 LoC) |
| §7 bench | onboarding-time / lookup-time / correction-rate | `cli/axi_workbench/bench.py` (203 LoC) |
| Rust dual-entry shim | AXI_WORKBENCH_RS=1 opt-in to canonical Rust binary | `cli/axi_workbench/rs_shim.py` (83 LoC) |
| Health check runner | 8-check suite, exception isolation | `cli/axi_workbench/checks/__init__.py` (80 LoC) |
| Per-check modules | readme / handoff / startup / verify / git / registered / high-impact / tests | `cli/axi_workbench/checks/*.py` (515 LoC) |
| Partition scanner | Reads `workspace.json` partition layout | `cli/axi_workbench/scanner/partition.py` (63 LoC) |
| Candidate scorer | Confidence high/medium/low scoring | `cli/axi_workbench/scanner/candidate.py` (142 LoC) |
| Regression suite | 31 tests covering scan/confirm/dashboard/graph/health/bench | `tests/test_workbench.py` (609 LoC) |
| Rust parity test | Live AXI_WORKBENCH_RS=1 shim test | `tests/parity/test_rust_vs_python.py` (44 LoC) |
| Conftest | Cross-project sys.path setup | `tests/conftest.py` |
| PRD | v1.1 template, FR-1..FR-9, AC-1..AC-9 | `PRD.md` |
| Smoke script | --help / scan / summary dual-side | `scripts/python-cli-smoke.sh` |
| ADR-012 | Rust migration plan + §5 close-out | `docs/adr/ADR-012-*.md` (2 files) |
| Post-M4 parity report | Python ↔ Rust subcommand byte parity | `evidence/parity/PARITY-postm4-2026-10-03.md` |
| Post-mortem | M4 consolidation lessons | `docs/M4-POSTMORTEM.md` |
| Workflows | CLI-ONBOARD-001 / CLI-TRIAGE-001 / CLI-HEALTH-001 | `docs/workflows/*.md` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Phase 0 (2026-09-21) | Initial Python CLI from `incubator/workbench-governance/` | Done |
| Round 1 (2026-09-21) | scan / onboard / 8 health checks / dashboard / graph / 18 tests | Done |
| Round 2 (2026-09-21) | dashboard `inferrer` / `correct` / `bench` metrics / 29 tests | Done |
| Round 3 (2026-09-21) | declared-relations inference + `relate` writer + 31 tests | Done |
| PRD-04 Change Sync | `confirm` emits Change event; idempotent re-confirm | Done 2026-09-21 |
| Promote | `incubator/workbench-governance` → `foundation/axi-workbench-cli` | Done 2026-09-21 |
| v1.1 PRD template upgrade | template_version + inherits + FR-9 + 4-layer L0-L3 + AR-PRD-FORMAT-* anchors | Done 2026-09-27 (`d73dd5f`) |
| M1 (Rust migration) | 8 health checks + bin + ID resolve in Rust | Done 2026-10-03 (`2739be3`) |
| M2 (Rust migration) | petgraph refactor + DOT/JSON parity + Python parity driver | Done 2026-10-03 (`f487d56`) |
| M3 (Rust migration) | retire `src-rs/axi-workbench-cli-rs/` scratch | Done 2026-10-03 (`674d6f8`) |
| M4 (Rust migration) | canonical Rust binary at workspace-rs; AXI_WORKBENCH_RS dual-entry | Done 2026-10-03 (`378e431`, `a39352f`) |
| M1 (MILESTONE.md) | handoff-check 闭环 | active |
| M2 (MILESTONE.md) | PRD 进入真实内容阶段 | pending (PRD.md v1.1 already in place) |
| M3 (MILESTONE.md) | next-stage promotion per lifecycle policy | pending |
| TODO-T-001 | 统一 CLI 入口到 bin/axi-workbench | Active |
| TODO-T-002 | 补全与 workspace-project MCP server 的等价命令集 | Active |
| Python CLI retirement | post-M4 future work per ADR-012 §4.4 (cross-ref `docs/PYTHON-CLI-RETIREMENT.md` in workspace-rs) | Pending |

Recent commit trajectory (`git log --oneline -25`):

```
a7539b3 chore(workbench-cli): add python-cli-smoke.sh
925774b test(parity): add AXI_WORKBENCH_RS=1 live shim test
f10d5f9 docs(ADR-012): 8-section close-out for ADR-012 §5
a39352f feat(workbench-cli): AXI_WORKBENCH_RS dual-entry shim for health/graph/project
4190cff docs(M4-POSTMORTEM): post-mortem of the 2026-10-03 Rust migration consolidation
76a9d05 docs(AGENTS): add canonical Rust binary path + verification commands
8f502c1 docs(parity): add post-M4 PARITY.md report (Rust canonical binary at workspace-rs)
f4ce80b docs(workbench-cli): append M2/M3/M4 Rust migration consolidation entry to CHANGELOG
ac8a83c fix(workbench-cli): update parity runner to canonical workspace-rs binary path
674d6f8 chore(workbench-cli): retire src-rs/axi-workbench-cli-rs scratch (ADR-012 M4 relocation)
f487d56 feat(workbench-cli): rust M3 parity driver + petgraph refactor (graph + project)
2739be3 feat(workbench-cli): rust scaffold Phase M2 lands (8 checks + bin + ID resolve)
2cbdf3b fix(workbench-cli): collapse multi-line format arg in graph.rs stub
47f4096 feat(workbench-cli): add rust migration scaffold
7bd67aa docs(workbench-cli): add ADR-012 rust migration plan
d73dd5f docs(prd): upgrade axi-workbench-cli PRD to v1.1 template
1a34244 test(infra): add tests/conftest.py for cross-project sys.path setup
55b4021 docs(i18n): fix zh-CN README mirror missing PYTHONPATH token
73b1435 sync axi-workbench-cli docs + evidence (chunk 1)
f2370b0 sync axi-workbench-cli docs + evidence (governance docs)
49862f7 fix(hooks): record workspace changes and surface failures
827ed10 chore(githooks): remove || true from post-commit so failures surface
```

工作树：分支 `dev`，领先 origin 15 / 落后 1；已修改 `evidence/parity/parity_rows.json`；8 个未跟踪的 submit log。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/AGENTS.md) — read order + boundaries + verification commands
- [`README.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/README.md) — quick start + layout + 8-check + graph + bench recipes
- [`README.zh-CN.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/README.zh-CN.md) — Chinese-language mirror
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/PRD.md) — v1.1 PRD: 4-layer L0-L3 + FR-1..FR-9 + AC-1..AC-9
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/CHANGELOG.md) — Keep a Changelog with `[Unreleased]` + rounds 1-3 + promote + M2/M3/M4 Rust consolidation
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/CHANGE.md) — behavior-affecting change record
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/TODO.md) — TODO-T-001 / TODO-T-002 active
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/MILESTONE.md) — M1 active / M2 / M3 pending
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/HANDOFF.md) — zero-context takeover brief
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/VERIFICATION.md) — gate matrix for AC-1..AC-9
- [`docs/M4-POSTMORTEM.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/M4-POSTMORTEM.md) — Rust migration consolidation post-mortem
- [`docs/adr/ADR-012-workbench-cli-rust-migration.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/adr/) — Rust migration plan
- [`docs/adr/ADR-012-section-5-closeout.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/adr/) — §5 close-out
- [`docs/workflows/CLI-ONBOARD-001.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/workflows/) — onboarding workflow
- [`docs/workflows/CLI-TRIAGE-001.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/workflows/) — triage workflow
- [`docs/workflows/CLI-HEALTH-001.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/docs/workflows/) — health-check workflow
- [`evidence/parity/PARITY-postm4-2026-10-03.md`](/Volumes/code/workspace/foundation/axi-workbench-cli/evidence/parity/) — Rust ↔ Python parity report
- [`evidence/onboarding.log`](/Volumes/code/workspace/foundation/axi-workbench-cli/evidence/) — AC-1/AC-2 capture
- [`evidence/health-axi-rules.log`](/Volumes/code/workspace/foundation/axi-workbench-cli/evidence/) — AC-3 capture

## Cross-References

本仓库**提供**（据 `docs/HANDOFF.md:38` + `PRD.md:144`）：

- `workbench-cli` — 主 CLI 面
- `project-scanner` — 分区遍历 + 候选打分
- `health-checks-v1` — 8 项健康检查 JSON 契约
- `project-graph-v1` — graph JSON/DOT 输出契约
- `workspace-dashboard-v1` — 仪表板 JSON 契约，由 `workbench/axi-workbench` GUI 消费

本仓库**消费**（据 `docs/HANDOFF.md:39`）：

- `axi-kernel` (`foundation/axi-kernel`) — PRD-01 Kernel 对象注册表，通过 sys.path 插入
- `axi-workspace-governance` (`foundation/workspace-governance`) — 注册身份
- `axi-workspace-rs` (`foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/`) — AXI_WORKBENCH_RS=1 shim 后面的 Rust 移植
- `axi-observability` (`foundation/axi-observability`) — 可选的结构化日志

下游消费者：

- `workbench/axi-workbench`（GUI）消费 `workspace-dashboard-v1` capability JSON
- 其他运行 `workspace-project consumers axi-workbench-cli` 的 agent 可看到本项目的 consumers 列表（`PRD.md:148-149`）

姐妹项目：

- `foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/` — 据 ADR-012 §5 Phase M4（`378e431`）的规范化 Rust CLI。Python 退役计划记录于 `foundation/axi-workspace-rs/docs/PYTHON-CLI-RETIREMENT.md`（据 ADR-012 §4.4）。这里的 `AXI_WORKBENCH_RS=1` shim 是退役推广期间的桥梁；一旦 Rust 移植的 `health` / `graph` / `project` 面稳定下来，Python 路径即可移除。

## 说明

- Python CLI 为 owner-internal（`pyproject.toml:11-15`）；规范化二进制位于 `foundation/axi-workspace-rs/target/debug/workbench`。
- 31 项测试 + parity 套件；M2/M3/M4 Rust 整合于 2026-10-03 完成。
- `dev` 上的工作树：领先 origin 15 / 落后 1；已修改 `evidence/parity/parity_rows.json` + 8 个未跟踪的 submit log。