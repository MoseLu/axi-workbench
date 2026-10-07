---
id: axi-docs-en-projects-axi-workbench-cli
title: Axi Workbench CLI (Python)
type: project
status: published
tags: [Axi Docs, Projects, foundation, python, governance-cli, kernel, scanner, dashboard, health-checks]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workbench CLI
graph-tags: [Foundation, Python, Governance]
description: Canonical Python CLI for the AXI Personal OS Workbench (PRD-02). Scans workspaces, runs 8 health checks per project, emits DOT/JSON graphs and dashboards, exposes §7 measurement primitives. Sits on top of the PRD-01 Kernel via runtime sys.path insertion. The per-project Rust port lives at foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/.
project:
  id: axi-workbench-cli
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-workbench-cli
  source-section: shared
---

# Axi Workbench CLI (Python)

> Source of truth:
> [`/Volumes/code/workspace/foundation/axi-workbench-cli/`](/Volumes/code/workspace/foundation/axi-workbench-cli/).
> Section: shared / Partition: `foundation/`.

## Summary

The Axi Workbench CLI is the **canonical Python governance CLI for the
AXI Personal OS Workbench** (PRD-02). It scans a workspace, scores
candidate projects by confidence, registers accepted candidates into
the PRD-01 Kernel in a single atomic batch, runs 8 health checks per
registered project, emits a relationship graph (DOT + JSON)
combining declared Kernel relations with inferred AGENTS.md
cross-references, exposes a per-type / per-stage / per-tech-stack
dashboard, and exposes `bench` measurement primitives for PRD-02 §7.

The Python implementation is a **thin layer on top of the PRD-01
Kernel** (`foundation/axi-kernel`): the runtime `sys.path` insertion
in `cli/axi_workbench/kernel_bridge.py` resolves the Kernel package
by walking up from the CLI file looking for
`incubator/object-registry/axi_kernel`, with the canonical
`/Volumes/code/workspace/foundation/axi-kernel` path preferred and
`AXI_KERNEL_PATH` env override as final fallback
(`kernel_bridge.py:25-49`). It is **CLI-only** (no Web UI per PRD-02
§5), **read-only by default** (only `confirm` writes Kernel), and
**owner-internal** (not published to a public index per
`pyproject.toml:11-15`).

A **dual-entry shim** (`cli/axi_workbench/rs_shim.py:42-83`) lets
operators opt in to the canonical Rust binary at
`/Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench`
via `AXI_WORKBENCH_RS=1` for the `health` / `graph` / `project`
subcommands without changing the user-facing command line
(`rs_shim.py:11-16`). This was added in commit `a39352f` as part of
the M4 Rust migration consolidation (ADR-012 §4.4).

**Current state**: branch `dev` (15 ahead, 1 behind origin), M2/M3/M4
Rust migration consolidation complete 2026-10-03 (commit `f4ce80b`
CHANGELOG entry); 31 tests in `tests/test_workbench.py`; new parity
test `tests/parity/test_rust_vs_python.py` (44 LoC) added 2026-10-03
(`925774b`) for the `AXI_WORKBENCH_RS=1` live shim. The PRD was
upgraded to v1.1 template on 2026-09-27 (`d73dd5f`). The
`foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/` Rust port
holds the canonical CLI per ADR-012 §5 Phase M4; this Python repo is
the consumer-facing surface during the M4 follow-up rollout.

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

Total Python source: 3,078 LoC across 22 files (per `wc -l` of
`cli/axi_workbench/*.py` + `cli/axi_workbench/{checks,scanner}/*.py` +
`tests/test_workbench.py`).

## Build & Install

No `pip install` step. The package is owner-internal (`pyproject.toml:11-15`).

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

The canonical Rust binary path is hardcoded in `rs_shim.py:26-28`:

```python
DEFAULT_RUST_BINARY = (
    "/Volumes/code/workspace/foundation/axi-workspace-rs/target/debug/workbench"
)
```

## Verification

Per `AGENTS.md:49-77`:

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

Pass criteria: `python3 -m unittest` 0 failures; `workspace-project
validate` clean exit; `cargo test` 26+ passing tests
(`AGENTS.md:78-80`).

## Architecture Highlights

**Four-layer architecture (PRD-02 §2).** The codebase maps cleanly
into 4 unidirectional layers: **L0** `kernel_bridge.py` injects
`axi_kernel` onto `sys.path` and raises `exit 3` if missing
(`kernel_bridge.py:46-49`); **L1** `onboarding.py` reads workspace
partitions and writes to Kernel via `register_many` (idempotent);
**L2** `dashboard.py` + `graph.py` + `checks/` deliver the
governance views (8 health checks, dot/json graph, summary/inspect/
blocked/recent/pending/tech-stack/context-pack); **L3** `__main__.py`
dispatches CLI subcommands. Per PRD-02 §2.1, dependencies flow only
downward; reverse references = layered violations.

**8 health checks (PRD-02 §4 W4).** Registered in
`cli/axi_workbench/checks/__init__.py:32-41` in deterministic order:
`readme` (24 LoC) / `handoff` (28 LoC) / `startup-command` (68 LoC) /
`verify-command` (68 LoC) / `git-status` (68 LoC, accepts
`main|dev|agent/.*|feat/.*|fix/.*|chore/.*|release/.*` per
`git_status.py:18`) / `registered` (50 LoC) / `high-impact-changes`
(55 LoC) / `tests` (59 LoC). Each returns a `CheckResult` with
`ok/warn/fail` status + `evidence_path` + `reason` + `detail` (the
latter for actionable debugging). The runner (`__init__.py:44-74`)
isolates per-check exceptions so a single failing check does not
crash the suite.

**Read-only by default + explicit confirm.** The CLI never writes to
Kernel unless the operator explicitly invokes `confirm
--candidates <file> --ids <csv>`; all other subcommands are
read-only. `onboarding.py:53-80` builds a `ProjectObject` from the
candidate, honors `corrected_*` overrides via `correct`, calls
`register_many` for atomic write, and persists a `Workbench Change`
event for Change Sync consumers (`CHANGELOG.md:13-19`). Re-confirming
an already registered project is idempotent.

**AXI_WORKBENCH_RS dual-entry shim.** `rs_shim.py:31-39` reads
`AXI_WORKBENCH_RS` from the environment (anything other than `"1"`
is off); `run_via_rust(argv)` shells out to the canonical Rust binary
with `argv` forwarded verbatim (no argument translation). The shim
raises `RuntimeError` if the binary is missing rather than silently
falling back, so misconfiguration surfaces early during M4 follow-up
rollout (`rs_shim.py:70-75`). Today the Rust port implements
`health` / `graph` / `project list|inspect`; everything else falls
through to Python.

**Declared-relations auto-inference.** `inferrer._declared_dependencies()`
walks `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` and
pulls names matching workspace patterns (`axi-...`, `ielts-vocab`,
`story-graph`). `graph.write_declared_uses()` + CLI `relate` writes
`Relation(kind=USES)` edges from manifest-declared deps to registered
Project ids, idempotently (`CHANGELOG.md:30-46`). The live workspace
currently declares no internal deps so `declared_count` over real
data is 0 — the pipeline is exercised via the sandbox self-check.

**§7 measurement harness.** `bench.py` (203 LoC) implements three
metrics: `onboarding-time`, `lookup-time`, `correction-rate`. Output
goes to `evidence/bench.log` files (multiple captures from
2026-09-20 round 1 and 2 in `evidence/`).

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

Working tree: branch `dev`, 15 ahead / 1 behind origin; modified
`evidence/parity/parity_rows.json`; 8 untracked submit logs.

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

This repo **provides** (per `docs/HANDOFF.md:38` + `PRD.md:144`):

- `workbench-cli` — main CLI surface
- `project-scanner` — partition traversal + candidate scoring
- `health-checks-v1` — 8 health check JSON contract
- `project-graph-v1` — graph JSON/DOT output contract
- `workspace-dashboard-v1` — dashboard JSON contract consumed by `workbench/axi-workbench` GUI

This repo **consumes** (per `docs/HANDOFF.md:39`):

- `axi-kernel` (`foundation/axi-kernel`) — PRD-01 Kernel object registry via sys.path insertion
- `axi-workspace-governance` (`foundation/workspace-governance`) — registration identity
- `axi-workspace-rs` (`foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/`) — Rust port behind the AXI_WORKBENCH_RS=1 shim
- `axi-observability` (`foundation/axi-observability`) — optional structured logging

Downstream consumers:

- `workbench/axi-workbench` (the GUI) consumes `workspace-dashboard-v1` capability JSON
- Other agents running `workspace-project consumers axi-workbench-cli` see this project's consumers list (`PRD.md:148-149`)

Sister project:

- `foundation/axi-workspace-rs/crates/axi-workbench-cli-rs/` — Rust canonical CLI per ADR-012 §5 Phase M4 (`378e431`). Python retirement plan documented in `foundation/axi-workspace-rs/docs/PYTHON-CLI-RETIREMENT.md` (per ADR-012 §4.4). The `AXI_WORKBENCH_RS=1` shim here is the bridge during the retirement rollout; once the Rust port's `health` / `graph` / `project` surface stabilizes, the Python paths can be removed.

## Notes

- Python CLI is owner-internal (`pyproject.toml:11-15`); canonical binary lives at `foundation/axi-workspace-rs/target/debug/workbench`.
- 31 tests + parity suite; M2/M3/M4 Rust consolidation complete 2026-10-03.
- Working tree on `dev`: 15 ahead / 1 behind origin; modified `evidence/parity/parity_rows.json` + 8 untracked submit logs.