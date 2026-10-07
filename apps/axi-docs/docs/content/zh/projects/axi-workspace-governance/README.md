---
id: axi-docs-zh-projects-axi-workspace-governance
title: Axi 工作区治理
type: project
status: published
tags: [Axi Docs, 项目, foundation, governance, nodejs, registry, audit, agent-runtime]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi 工作区治理
graph-tags: [Foundation, Governance]
description: /Volumes/code/workspace 的轻量级治理权威源：workspace.json 注册表、项目准入门控、审计 + 交接 CLI (workspace-project)、孵化器模板、governance-decision/v1 契约以及 Axi Docs 镜像。
project:
  id: axi-workspace-governance
  partition: foundation
  path: /Volumes/code/workspace/foundation/workspace-governance
  source-section: governance
---

# Axi 工作区治理

> 权威源：
> [`/Volumes/code/workspace/foundation/workspace-governance/`](/Volumes/code/workspace/foundation/workspace-governance/)。
> 章节：governance / 分区：`foundation/`。

## Summary

Axi Workspace Governance 仓库是整个 `/Volumes/code/workspace` 容器的**轻量级权威源**。它持有 `workspace.json`（规范化工作区声明，约 1.3k 行，schemaVersion `2026-06-11`，`version: 1.3.0`），`scripts/` 目录下的 Node.js `.mjs` 治理驱动（65 项），admissions 文件夹（30+ 个已接纳的单项目准入），JSON schema，ADR（`docs/adr/` 下 10+ 项），契约三元组（`task-execution-routing/v1` 与 `governance-decision/v1`），版本化的 `registry/` 与 `state/` 文档，以及 `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/` 下的 Axi Docs 镜像源。

`package.json` 暴露 **40+ 个治理 pnpm 脚本**（`workspace:docs:sync`、`workspace:audit`、`workspace:flow`、`evolution:collect|analyze|propose|verify|report|apply`，契约测试套件，以及统一查询/校验/接入 CLI `workspace-project-cli.mjs`）。统一 CLI 入口（`workspace-project`）封装 18 个子命令（`list`、`local-services`、`show`、`deps`、`consumers`、`profile`、`health`、`verify`、`completion`、`handoff`、`onboard`、`handoff-check`、`validate`、`route-intent`、`admission-check`、`admission-show`、`incubation-check`、`whereami`）；见 `scripts/workspace-project-cli.AGENTS.md:14-36`。

**当前阶段**：工作区活跃的治理源。项目分支为 `agent/audit-fix-a10-path-compat`，工作区脏（含未提交的 `docs/state/agent-governance-phase0-baseline-2026-09-29.md` + 新建 `admissions/axi-file-preview.json` + 一份 `SECURITY.md`）；最近 30 个提交跨越 2026-09-26 → 2026-10-07，覆盖引用层级治理、`.auditignore` 路径生效、Rust 规范化位置同步（ADR-012 M4）、governance-decision/v1 契约三元组、三层级引用分级。`docs/state/CHANGELOG.md` 携带 Keep-a-Changelog `[Unreleased]` 块，包含 2026-09-12 → 2026-09-29 之间的 11 条带日期条目，覆盖 Evolution Evidence Plane、三层级引用、M11 BLOCKING 接纳以及 ADR 重编号（`ADR-009-workflow-first-bounded-agent.md` 于 2026-09-24 重编号以解决与新 `ADR-005-agent-bff-ownership.md` 的冲突）。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Runtime | Node.js ≥ 20.0.0 (`engines.node` `package.json:50`) | ESM-only (`"type": "module"`) |
| Package manager | pnpm ≥ 8.0.0 (Corepack-pinned `packageManager: pnpm@10.33.2` per `package.json:6`) | Vendored at `scripts/vendor/corepack` |
| Governance scripts | Plain Node `.mjs` (no TypeScript) | 65 entries under `scripts/`, mostly zero-dep |
| Schema | Hand-written JSON Schema (`schemas/*.schema.json`) | 7 schemas: `incubation-v1`, `project-admission-v1`, `project-maturity-v1`, `dev-services.config`, `devsvc.server-checks`, `project-docs-manifest-v2`, `rbac-grants-v1` |
| Contract triples | JSON Schema + handwritten contract tests (`scripts/task-execution-routing-contract.test.mjs`, `scripts/governance-decision-contract.test.mjs`) | `task-execution-routing/v1` (decision/lifecycle-event/effect-proposal) + `governance-decision/v1` (decision/execution-plan/tool-manifest) |
| Templates | Markdown (`templates/project-admission-gate.md`, `templates/workspace-audit-remediation-trigger.md`, `templates/incubator/`) | Source for the agent-runtime `AGENTS.md` inheritance chain |
| Audit / registry | JSON snapshots (`docs/state/`, `.workspace/registry.json`) | Generated, never hand-edited |
| Axi Docs mirror | VitePress source under `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/` | `documentation.axiDocsSource.path` in `workspace.json:116` |
| Reference sync tool | Custom Node CLI at `scripts/workspace-docs-sync.mjs` (602 LoC) | Walks `workspace.graph.json` + `workspace.json` and emits Markdown index |
| Python helpers | `audit-commit-helper.py` + `batch-commit-executor.py` + `verify_doc_i18n.py` + `e01-apply-resource-search-stack.py` | Bypass pnpm for batched governance commits |

## Project Layout

```text
foundation/workspace-governance/
├── package.json                       # 1.3.0, 40+ scripts, pnpm 10.33.2 pinned
├── workspace.json                     # Canonical workspace declaration (1.2k lines)
├── AGENTS.md                          # Agent rules + verification commands
├── INDEX.md / INDEX.zh-CN.md          # Doc-map for humans
├── README.md / README.zh-CN.md        # Entry points
├── CHANGE.md / CHANGELOG.md           # Pointer to canonical CHANGELOG
├── MILESTONE.md / TODO.md / SECURITY.md
├── CODEOWNERS / CleanNulNull.bat
├── workflow-policy.json               # Lore Commit Protocol policy
├── agent/                             # PLAN.md + QWEN.md
├── admissions/                        # 30+ accepted project admissions
├── contracts/
│   ├── axi-todo/                      # todo-flow contracts
│   ├── change-set/v1/                 # Cross-repo Change Set schema
│   ├── evolution/v1/                  # Evolution evidence plane contracts
│   ├── governance-decision/v1/        # decision + execution-plan + tool-manifest
│   ├── local-services/v1/             # Local services discovery
│   ├── project-display.v1.schema.json
│   ├── rbac-grants/v1/
│   ├── release-evidence/v1/
│   ├── task-execution-routing/v1/     # decision + effect-proposal + lifecycle-event
│   ├── todo-flow/
│   └── workspace-flow/
├── docs/
│   ├── ARCHITECTURE.md / HANDOFF.md / RELEASING.md
│   ├── adr/                           # ADR-001..010 + ADR-016 + README
│   ├── architecture/git-system.md
│   ├── audits/                        # 8 dated audit reports (2026-06-11 → 2026-09-26)
│   ├── corepack.md
│   ├── evolution/                     # Evolution Evidence Plane docs
│   ├── governance/SECURITY.md
│   ├── logs/                          # Audit logs
│   ├── policies/                      # Lifecycle + release policy
│   ├── project-docs.manifest.json
│   ├── proposals/
│   ├── specs/                         # 4 dated design specs (admission, incubator, etc.)
│   ├── standards/
│   ├── state/                         # CHANGELOG.md / TODO.md / MILESTONE.md / TDD.md / PRD.md
│   └── workflows/
├── projects/                          # Active business mirrors (legacy; 2026-04-01 converged)
├── references/                        # Short-term third-party refs (Blinko / Cockpit / ComfyUI / DBSkill / Image2Prompt / OpenCodex / Sub2API / Tidewater)
├── schemas/                           # 7 JSON Schemas
├── scripts/                           # 65 governance scripts (see "Key Modules/Files")
├── shared/                            # Shared capability mirrors (legacy)
├── src-rs/                            # Empty (Rust workspace migrated to axiom-workspace-rs)
├── templates/                         # project-admission-gate.md, workspace-audit-remediation-trigger.md, incubator/
├── tools/                             # Local tool mirrors
└── workbench/                         # Axi Workbench mirror
```

Axi Docs 镜像位于仓库之外
`workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/`
（在 `workspace.json:116` 中以 `documentation.axiDocsSource.path` 声明），
由 `pnpm workspace:docs:sync` 重新生成。

## Build & Install

```bash
# Bootstrap governance repo (Node 20+, pnpm 10.33.2 via Corepack)
npm --prefix scripts/vendor/corepack install
/Volumes/code/workspace/scripts/runtime/corepack pnpm install

# Generate registry from workspace.json
pnpm workspace:registry:sync

# Generate human-readable docs index
pnpm workspace:docs:sync

# Run audit
pnpm workspace:audit

# Incubator + agent guidance sync
pnpm workspace:incubator:sync
pnpm agent-guidance:sync
```

本仓库没有 `build` 步骤 —— 仅为治理 + 文档。所有输出文件
（`docs/state/*.md`、`.workspace/registry.json`、Axi Docs 镜像）都是**生成产物**，
严禁手工编辑（参见 `AGENTS.md:21-22`）。

## Verification

来自 `AGENTS.md:25-31`：

```bash
pnpm install
pnpm test
pnpm build
```

工作区 CLI 暴露的真实校验面：

```bash
node scripts/workspace-project-cli.mjs validate                  # graph + registry + index consistency
node scripts/workspace-project-cli.mjs onboard <project-id>      # two-minute takeover brief
node scripts/workspace-project-cli.mjs handoff-check <project-id># zero-context handoff gate
node scripts/workspace-audit.mjs                                  # structure + drift audit
node scripts/workspace-flow.mjs                                   # cross-repo Change Set + maturity
node scripts/sync-agent-guidance.mjs --check                      # verifies root AGENTS.md matches generated
```

测试入口（按 `package.json:25-48`）：

- `pnpm workspace:flow:test` — node --test 跑 `scripts/workspace-flow.test.mjs`
- `pnpm workspace:contracts:test` — 聚合 `workspace-flow.test.mjs` + `workspace-git-hooks.test.mjs` + `task-execution-routing-contract.test.mjs` + `governance-decision-contract.test.mjs`
- `pnpm admission:test` — admission + incubator + sync-agent-guidance 套件
- `pnpm contracts:axi-todo:test`、`contracts:task-execution-routing:test`、`contracts:governance-decision:test` — 按契约
- `pnpm completion:test`、`verification:test`、`git-hooks:test`、`handoff:test`、`evolution:test`

## Architecture Highlights

**三段式 registry / graph / index。** 规范化工作区声明为 `workspace.json`（1.2k 行，按 category 划分：`agent` / `distributions` / `infra` / `products` / `projects` / `shared` / `tools` / `candidates` / `references`，另有 `settings.*`、`schemaVersion`、`version`）。机器可读补集是工作区根目录的 `workspace.graph.json`（`schemaVersion: 2026-06-18`），人可读补集是工作区根目录的 `WORKSPACE_INDEX.md`。三段式检查是承载性门槛：准入只有在 `validate` 输出 "ok"、`audit` 返回 0 错误、`workspace:docs:sync` 已重建索引后才算结束。`AGENTS.md:34-45` 记录了这一点。

**`workspace-project-cli.mjs` 作为统一 CLI 入口。** 该 586-LoC CLI（`scripts/workspace-project-cli.mjs:28-123`）将 18 个子命令分派到四个支持库：`project-handoff.mjs`（最大，约 620 LoC；onboard / handoff / handoff-check / completion）、`project-admission.mjs`（route-intent / admission-check / admission-show / validate）、`workspace-incubator.mjs`（incubation 校验）、`workspace-lib.mjs`（路径解析）。其文档位于 `scripts/workspace-project-cli.AGENTS.md`，与工作区级 `AGENTS.md` 镜像，并定义 `excluded` 生命周期快捷方式（`workspace-project-cli.AGENTS.md:119`）。

**项目准入门控。** 一种机器强制生命周期：每个项目必须（a）落入 `tier.values` 枚举（`axi-core-product` / `axi-spun-out-product` / `axi-shared-foundation` / `axi-shared-infra` / `axi-shared-reference` / `axi-local-tool` / `external-infra` / `third-party-reference` / `axi-candidate` / `axi-archive`，见 `workspace.json:905-920`），并且（b）携带按 `schemas/project-admission-v1.schema.json` 校验通过的 `admissions/<project-id>.json` 接纳记录。创建前，必须执行 `workspace-project route-intent --intent <i> --domain <d> [--capability] [--boundary] --json` 步骤；它返回 `reuse-existing` / `shared-provider` / `new-project-candidate` / `incubate` / `rejected` 决策以及对应的 `requiredReads` 列表（见 `workspace-project-cli.mjs:160-176`）。

**Incubator 作为非项目分区。** 据 `docs/policies/project-lifecycle-and-release.md`，尚不够格成为项目的想法 / demo / 原型应进入 `/Volumes/code/workspace/incubator/<slug>/`，携带 `incubation.json` + `IDEA.md` / `DESIGN.md` / `TASK.md` 信封，由 `workspace-incubator-sync.mjs` 按 `schemas/incubation-v1.schema.json` 校验。晋升必须重新执行 `route-intent` 并迁移到返回的 host/provider/project；禁止就地转换。

**Contracts 层。** 两组版本化契约三元组治理 agent runtime。`task-execution-routing/v1`（decision + effect-proposal + lifecycle-event）是 ADR-005 / `ADR-009-workflow-first-bounded-agent.md` 引用的路由词汇表。较新的 `governance-decision/v1`（decision + execution-plan + tool-manifest）增加了 `transformedPlan` 字段与 4 路 guard 裁决（`allow` / `deny` / `transform` / `pause`）；通过 `routingDecisions[]` 引用路由决策，见 `docs/state/CHANGELOG.md:20-24`。跨契约测试（`scripts/governance-decision-contract.test.mjs`）校验 `steps[].tool ⊆ allowedTools[]` —— 一种 JSON Schema 无法表达的约束。

**Evolution Evidence Plane。** 独立只读循环（`scripts/evolution-{collect,analyze,propose,verify,report,apply}.mjs`）采集脱敏观察、聚类重复发现、生成审批门控提案、运行静态或显式请求的校验、报告采纳指标。输出由 `docs/evolution/README.md` 门控，`evolution:apply` 步骤需要所有者 ack。2026-09-12 发现（`docs/state/CHANGELOG.md:28`）。

## Key Modules/Files

| Module / file | Responsibility | Path |
| --- | --- | --- |
| Workspace declaration | Canonical 1.2k-line declaration with category/tier/schemaVersion | `workspace.json` |
| Unified CLI dispatch | 18 subcommands over 4 libraries | `scripts/workspace-project-cli.mjs` (586 LoC) |
| CLI AGENTS doc | Per-subcommand table + error table + extension points | `scripts/workspace-project-cli.AGENTS.md` |
| Handoff library | onboard / handoff / handoff-check / completion / validateProjectManifest / findGraphProjectByPath | `scripts/project-handoff.mjs` |
| Admission library | route-intent / admission-check / admission-show / validateRegistryAdmissions / validateAdmissionProposal | `scripts/project-admission.mjs` |
| Incubator library | incubator root + per-directory validation | `scripts/workspace-incubator.mjs` (311 LoC) |
| Audit driver | Path / naming / drift / registry checks | `scripts/workspace-audit.mjs` (825 LoC) |
| Docs sync driver | Graph → markdown index + Axi Docs mirror | `scripts/workspace-docs-sync.mjs` (602 LoC) |
| Registry sync | `workspace.json` → `.workspace/registry.json` (generated) | `scripts/workspace-registry-sync.mjs` (94 LoC) |
| Git status aggregator | Per-repo clean / ahead / push policy across registered projects | `scripts/workspace-git-status.mjs` (220 LoC) |
| Incubator sync | Push root contract + starter templates from `templates/incubator/` | `scripts/workspace-incubator-sync.mjs` |
| Agent guidance sync | Distill `templates/project-admission-gate.md` into root `AGENTS.md` for each CLI | `scripts/sync-agent-guidance.mjs` |
| Flow driver | Change Set / release evidence / maturity stage checks | `scripts/workspace-flow.mjs` (210 LoC) |
| Completion / verification | Snapshot completion JSON + verification.md evidence | `scripts/workspace-completion.mjs`, `scripts/workspace-verification.mjs` |
| Handoff eval | Zero-context handoff JSON build + eval | `scripts/zero-context-handoff-eval.mjs` |
| Change ledger | Cross-repo change-set artifact | `scripts/workspace-change-ledger.mjs` |
| Evolution loop | collect / analyze / propose / verify / report / apply | `scripts/evolution-{collect,analyze,propose,verify,report,apply}.mjs` |
| Decision contract test | 33-line cross-field invariant | `scripts/task-execution-routing-contract.test.mjs`, `scripts/governance-decision-contract.test.mjs` |
| ADRs | 11 decisions (governance repo as index plane → M11 Rust migration plan) | `docs/adr/ADR-001..010`, `ADR-016-workspace-governance-rust-migration.md` |
| Schemas | 7 machine-readable contracts | `schemas/{incubation-v1,project-admission-v1,project-maturity-v1,...}.schema.json` |
| Admission records | 30+ accepted standalone-project admissions | `admissions/*.json` |
| Templates | Canonical agent-runtime gate text | `templates/project-admission-gate.md`, `templates/workspace-audit-remediation-trigger.md`, `templates/incubator/` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Foundation | workspace.json v1.3.0 + 11 ADRs | Done |
| M10 docs phase | Three-tier reference governance + governance-decision/v1 trio + Evolution Evidence Plane + cross-doc sync | Done (2026-09-29, 11 changelog entries) |
| M11 BLOCKING owner decisions | 8 BLOCKING (D14/15/16/17/22/23/29/33) + D43 accepted; D44-D67 deferred to M12+ | Accepted 2026-10-03 (`docs/state/CHANGELOG.md:13-23`) |
| Rust migration | Phase 1 read-only subset at `axi-workspace-rs/crates/workspace-governance-rs` | Phase 1 done (M4 landed 2026-09-29); Phase 2-4 deferred to owner opt-in |
| Axi Docs mirror | `documentation.axiDocsSource` resolved at `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/` | Live; regenerated by `pnpm workspace:docs:sync` |
| D4 registry integration | `workspace.json` entry + admission record; graph node + WORKSPACE_INDEX.md row + admission pointer in workspace.json still missing | Half-done; locked behind D4 owner opt-in (see `HANDOFF.md:589-602` of axi-workspace-rs) |

Recent commit trajectory (`git log --since="6 months ago"`, last 10):

```
5e50402 fix(governance): apply reference rename + stack fixes that prior waves intended
8e3e06a fix(governance): findGraphProjectByPath handles absolute and relative paths
106add6 feat(governance): workspace-audit honors .auditignore
8d15ddc fix(governance): record reference rename events in change log
956607f fix(governance): correct workspaceRoot alias in zero-context-handoff-eval
317e22e chore(workspace-governance): sync Rust canonical location for axi-workbench-cli (ADR-012 M4)
f1a1a87 chore(workspace-governance): record Rust canonical path for axi-workbench-cli (ADR-012 M4)
72d30d9 fix(governance): restore scripts/workspace-change-ledger.mjs + .test.mjs from 395f171
3ec54f3 feat(workspace-governance): add per-project git-hook verification to axi-workspace-rs admission
14b29de chore(workspace): point registry at private governance remote
```

工作区状态：分支 `agent/audit-fix-a10-path-compat`，领先 origin；
未跟踪 `SECURITY.md`、`admissions/axi-file-preview.json`、
`docs/state/agent-governance-phase0-baseline-2026-09-29.md`。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/workspace-governance/AGENTS.md) — agent rules + verification
- [`README.md`](/Volumes/code/workspace/foundation/workspace-governance/README.md) — Chinese-language entrypoint + governance commands
- [`INDEX.md`](/Volumes/code/workspace/foundation/workspace-governance/INDEX.md) — document map
- [`workspace.json`](/Volumes/code/workspace/foundation/workspace-governance/workspace.json) — canonical declaration (1.2k lines)
- [`docs/state/CHANGELOG.md`](/Volumes/code/workspace/foundation/workspace-governance/docs/state/CHANGELOG.md) — canonical change log (Unreleased + 0.1.0)
- [`docs/CHANGELOG.md`](/Volumes/code/workspace/foundation/workspace-governance/docs/CHANGELOG.md) — secondary change log (stub)
- [`docs/adr/ADR-001..010 + ADR-016`](/Volumes/code/workspace/foundation/workspace-governance/docs/adr/) — 11 architectural decisions
- [`docs/audits/`](/Volumes/code/workspace/foundation/workspace-governance/docs/audits/) — 8 dated audit reports
- [`docs/specs/2026-07-09-project-admission/`](/Volumes/code/workspace/foundation/workspace-governance/docs/specs/) — admission gate design
- [`docs/specs/2026-07-28-workspace-incubator/`](/Volumes/code/workspace/foundation/workspace-governance/docs/specs/) — incubator design
- [`docs/specs/2026-09-24-workspace-entrance-spatial-graph/`](/Volumes/code/workspace/foundation/workspace-governance/docs/specs/) — ADR-008 remediation
- [`docs/policies/project-lifecycle-and-release.md`](/Volumes/code/workspace/foundation/workspace-governance/docs/policies/) — maturity + promotion policy
- [`scripts/workspace-project-cli.AGENTS.md`](/Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.AGENTS.md) — CLI dispatch reference
- [`templates/project-admission-gate.md`](/Volumes/code/workspace/foundation/workspace-governance/templates/) — agent-runtime gate source
- [`templates/workspace-audit-remediation-trigger.md`](/Volumes/code/workspace/foundation/workspace-governance/templates/) — audit routing hook source
- [`contracts/task-execution-routing/v1/`](/Volumes/code/workspace/foundation/workspace-governance/contracts/) — routing contract triple
- [`contracts/governance-decision/v1/`](/Volumes/code/workspace/foundation/workspace-governance/contracts/) — decision + plan + tool-manifest triple

## Cross-References

本仓库**提供**（据 `workspace.json` governance tier）：

- `workspace-registry` (build phase) — `axi-agent`、`axi-rules`、`axi-workspace-rs`、所有 `axi-*-cli` 项目
- `governance-rules` (build phase) — 每个注册项目消费，用于 `pnpm workspace:docs:sync` 与 `pnpm workspace:audit`
- `project-admission` (build phase) — 创建前强制执行
- `workspace-audit` (runtime phase) — 在每个注册项目的每个 post-commit hook 上运行

本仓库**消费**（在 `workspace.json` 中声明）：

- `axi-rules` (`foundation/axi-rules`) 提供规则路由器 + 记忆优先级
- `axi-skills` (`foundation/axi-skills`) 提供 APM zero-context package layer（ADR-004）
- `axi-agent` (`agent-cluster/axi-agent`) 提供 Agent runtime + MCP transport
- `axi-workbench` (`workbench/axi-workbench`) 提供 Axi Docs 镜像托管

Rust 姐妹移植位于 `foundation/axi-workspace-rs/crates/workspace-governance-rs/`
持有 Phase 1（只读）Rust 实现，覆盖六个子命令
（`list`、`whereami`、`health`、`onboard`、`handoff-check`、
`validate`）；其余 21 个子命令在 Phase 2-4 完成前仍由 Node 承载
（ADR-016）。每 crate 契约 harness 位于
`tools/ctxt/contracts/workspace-governance-rs-parity/`，作为字节稳定的
parity 检查。

## 说明

- `workspace.json`、`.workspace/registry.json`、`docs/state/*.md` 和 Axi Docs 镜像均为**生成产物**，严禁手工编辑。
- 工作树在 `agent/audit-fix-a10-path-compat` 上脏（2026-10-07 快照）。
- 引用层级治理：ADR 重编号于 2026-09-24；三层级引用位于 `references/` 下。