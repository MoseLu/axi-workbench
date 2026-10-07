---
id: axi-docs-zh-projects-axi-rules
title: Axi Rules
type: project
status: published
tags: [Axi Docs, 项目, foundation, axi-core-product]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Rules
graph-tags: [Projects, foundation, agent-rules]
description: Workspace rule index + memory source-precedence + task-routing policy v1. Declarative Markdown rules consumed by agents at startup; not a runtime engine. 13 category modules + 3 generated JSON indexes + policy.bundle.json for Guard Runtime in axi-agent.
project:
  id: axi-rules
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-rules
  source-section: shared
---

# Axi Rules

> 项目根 `README.md` + `INDEX.md` + `PRD.md` 镜像。事实源：
> [`/Volumes/code/workspace/foundation/axi-rules/README.md`](/Volumes/code/workspace/foundation/axi-rules/README.md)、
> [`/Volumes/code/workspace/foundation/axi-rules/INDEX.md`](/Volumes/code/workspace/foundation/axi-rules/INDEX.md)、
> [`/Volumes/code/workspace/foundation/axi-rules/PRD.md`](/Volumes/code/workspace/foundation/axi-rules/PRD.md)。
> 分区：`foundation/`。领域：agent rules + SOP library。生命周期：shared（Axi agents 的 rank 2 权威）。

## Summary

`axi-rules` 是 Axi agents 的 **本地约束 + SOP 层**，也是 system / developer / 直接用户指令之后的 **第一本地权威**。它刻意保持显式，以便较弱的本地 agent（Claude Code CLI / MiniMax M3）能无歧义地执行。仓库是 **声明式文档 + 索引系统，不是运行时 rules engine** —— 规则是 Markdown 文档，由 agent 在启动时读取，并由 Codex Plus、Feishu、cc-connect 中的 bridge/RAG 消费者消费。

语料按 `rules/*/` 下 **13 个类别模块** 组织，每个模块都有顶层 `AGENTS.md` 和一条对应规则的 `AR-XXX-NNN`（或 `AR-XXX-YYY-NNN`）文件。类别覆盖 `agent-routing`、`memory`、`verification`、`safety`、`routing`、`change`、`handoff`、`lifecycle`、`project-bootstrap`、`development-sop`、`git-automation`、`cicd`、`codex-tooling`、`prd-format`（v1.1+）以及 `workspace-discovery`（2026-06+）。每个类别都有一个显式引用 `.claude/ARCHITECTURE.md` 的 `AGENTS.md`，并由 `scripts/guard-all-categories-have-agents-md.py` 强制。

`index/` 下三份 **机器可读索引** 由 `scripts/build-index.py`（3,587 LOC）生成，并由 `scripts/validate-index.py`（900 LOC，≥ 12 rules hard-check，schema v2）校验：`index/projects.json`（canonical workspace project routing mirror，`axi-rules.project-index.v2`）、`index/rules.json`（`axi-rules.rule-index.v2`，173 rules，生成 bundle hash `1d32df6f…`）、`index/sources.json`（`axi-rules.sources.v1` —— rank 1–5 precedence chain）。`index/fallbacks.md` 与 `index/task-execution-routing.v1.json` 补完合约；routing policy 由 `scripts/task_execution_routing.py:policy_document()` 确定性生成（无模型调用）。`scripts/build-policy-bundle.py` 输出 `policy.bundle.json`（158 KB，schema `policy.bundle/v1`，`policyVersion=governance-policy/v1`）给 `axi-agent` 中的 Guard Runtime。

React + three.js 可视化（`frontend/`）演示 memory-recall 流程；验证覆盖 `pnpm --dir frontend typecheck`、`pnpm --dir frontend test`、`pnpm --dir frontend build` 以及 `pnpm --dir frontend e2e`。统一入口是 `make rules`（`rules-build` + `rules-validate` + `rules-guard`）。

handoff workflow 由 `scripts/handoff-workflow.py`（AR-HANDOFF-004 mechanical gate；864 LOC）以及 Claude PreToolUse 硬阻塞（`scripts/hooks/claude-pretool-edit-gate.py`，由 `scripts/install-handoff-edit-gate.py` 安装）守护。`scripts/test-claude-noninteractive.py`（738 LOC）弱提示回归对外断言执行端到端 agent 交接；`--prepare-only` 模式 **仅用于诊断**，不可作为完整通过引用。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Rule corpus | Markdown + YAML frontmatter | `rules/<category>/AR-*.md` (one file per rule) + `<category>/AGENTS.md` (module contract) |
| Indexes | JSON + Markdown | `index/{projects,rules,sources,fallbacks,task-execution-routing}.{json,md}` (generated, never hand-edited) |
| Build / Validate | Python 3 | `scripts/build-index.py` + `scripts/validate-index.py` |
| Policy bundle | JSON | `policy.bundle.json` (158 KB; 173 rules; bundleHash `sha256`) |
| Handoff gate | Python + Claude PreToolUse hook | `scripts/handoff-workflow.py` + `scripts/hooks/claude-pretool-edit-gate.py` |
| Frontend | React + TypeScript + Vite + three.js | `frontend/` (separate `package.json`; `pnpm --dir frontend ...`) |
| Test runner | `unittest` + Node `node --test` + `pnpm --dir frontend e2e` | `scripts/test-*.py` + `scripts/policy-bundle-contract.test.mjs` |
| Combined entry | `make rules` | `rules-build` + `rules-validate` + `rules-guard` |
| ADR source | `foundation/workspace-governance/docs/adr/ADR-001..010` | Cross-referenced from `INDEX.md` |

## Project Layout

```text
foundation/axi-rules/
├── AGENTS.md                      # Root operating model + 90-second read order
├── README.md / README.zh-CN.md    # Purpose + Non-goals
├── INDEX.md                       # Fast path routing (Fast Path table + rule category index + ADR list)
├── CLAUDE.md                      # Claude-specific pointer
├── SECURITY.md
├── CONTRIBUTING.md                # 12 KB contribution guide
├── CHANGE.md                      # 8.7 KB behavior / workflow / validation change log (Unreleased newest-first)
├── CHANGELOG.md                   # Keep a Changelog [Unreleased] section
├── MILESTONE.md                   # M1 active / M2 pending / M3 pending (stage=shared) + SOP snapshot (9 categories)
├── TODO.md                        # Short task tracker
├── PRD.md                         # L2 PRD v1.1, 271 lines; FR-1…FR-8 + AC-1…AC-8; self-references AR-PRD-FORMAT-001..005
├── Makefile                       # `make rules` (rules-build + rules-validate + rules-guard)
├── package.json                   # `axi-rules-bundle-tooling`, scripts: build-policy-bundle, test:policy-bundle, lint:policy-bundle, check-inline-rules
├── pyproject.toml                 # (root) project metadata
├── policy.bundle.json             # 158 KB emitted artifact (173 rules; bundleHash sha256)
├── .claude/
│   ├── PARADIGM.md                # L1 paradigm: precedence + operating model + change protocol (AR-CHANGE-001)
│   └── ARCHITECTURE.md            # L2 architecture: L1 / L2 / L3 layering + index contracts + sync rules
├── rules/                         # 13 category modules (L2)
│   ├── agent-routing/             # AR-ROUTING-001..017 (8 files; AGENTS.md 240 LOC)
│   ├── memory/                    # AR-MEMORY-003..011 (9 files)
│   ├── verification/              # AR-VERIFY-001..003, AR-VERIFICATION-* (29 rules; largest category)
│   ├── safety/                    # AR-SAFETY-001..010
│   ├── routing/                   # (empty module placeholder; AR-FALLBACK-001 lives in index/fallbacks.md)
│   ├── change/                    # AR-CHANGE-001 in .claude/PARADIGM.md
│   ├── handoff/                   # AR-HANDOFF-007..015 (9 files; AGENTS.md 418 LOC)
│   ├── lifecycle/                 # AR-LIFECYCLE-006..014 (9 files; AGENTS.md 207 LOC)
│   ├── prd-format/                # AR-PRD-FORMAT-001..005 (v1.1+ constraint; AGENTS.md 154 LOC)
│   ├── project-bootstrap/         # AR-BOOTSTRAP-* + AR-CONFIG-PORT-INTENT-001 (10 files; AGENTS.md 203 LOC)
│   ├── development-sop/           # AR-DEVELOP-BOOTSTRAP-001..VERIFY-002 (19 files; largest by file count)
│   ├── git-automation/            # AR-GIT-001..010 (AGENTS.md 383 LOC, single largest module doc)
│   ├── cicd/                      # AR-CICD-005..016 (12 files)
│   ├── codex-tooling/             # AR-CODEX-001..003
│   ├── workflow/                  # AGENTS.md 6 LOC (placeholder)
│   ├── project-display/           # AGENTS.md 32 LOC (placeholder)
│   └── CHANGE.md                  # 4 KB rules-level change log
├── scripts/                       # 19 Python + 1 Node entry points
│   ├── build-index.py             # 3,587 LOC; generate 3 JSON + Markdown + sources.json + task-execution-routing.v1.json
│   ├── validate-index.py          # 900 LOC; hard-checks schema v2, ≥ 12 rules, ID cross-refs, doc entrypoints
│   ├── build-policy-bundle.py     # 607 LOC; Rule Compiler emitting policy.bundle.json (deterministic sha256)
│   ├── check-inline-rules.py      # 89 LOC; importable helper grouping inline AR-* headings
│   ├── guard-all-categories-have-agents-md.py  # 61 LOC; enforce every rule module has AGENTS.md
│   ├── handoff-workflow.py        # 864 LOC; AR-HANDOFF-004 9-step mechanical gate
│   ├── install-handoff-edit-gate.py  # wire Claude PreToolUse hook into settings.json
│   ├── task_execution_routing.py  # deterministic policy source
│   ├── policy-bundle-contract.test.mjs  # 10 Node `--test` cases
│   ├── policy-bundle.schema.json  # JSON Schema for bundle envelope + rule shape + stats
│   ├── test-claude-noninteractive.py  # 738 LOC weak-prompt regression
│   ├── test-handoff-workflow.py   # 335 LOC self-test + edit-gate assertions
│   ├── test-validate-index-state-transitions.py  # 695 LOC
│   ├── audit-frontend-testing.py  # 425 LOC behavior-first frontend testing audit
│   └── split-registry.py / find-my-skill.sh / build-registry.sh
├── scripts/hooks/claude-pretool-edit-gate.py  # Claude PreToolUse hard block
├── index/                         # GENERATED (do not hand-edit)
│   ├── projects.json + projects.md   # canonical workspace project routing mirror (schema v2)
│   ├── rules.json + rules.md         # rule metadata mirror (3,589 LOC JSON; 173 rules)
│   ├── sources.json                  # source precedence (rank 1–5) for bridge/RAG consumers
│   ├── docs-source.json              # docs source metadata for handoff
│   ├── fallbacks.md                  # human-readable fallback order
│   └── task-execution-routing.v1.json # deterministic workflow-engine policy
├── docs/                          # L3 entrypoints + lifecycle artifacts
│   ├── HANDOFF.md                 # 90-second read + contracts (readiness=verified)
│   ├── commit-convention.md
│   ├── governance/                # governance docs
│   ├── adr/                       # mirror of workspace ADR set
│   ├── logs/submit/               # auto-generated submit logs (untracked or committed)
│   ├── project-docs.manifest.json # manifest v2 contract
│   ├── specs/templates/           # lifecycle artifact templates
│   ├── specs/2026-06-13-* / 2026-07-09-* / 2026-07-28-* / 2026-08-10-* / 2026-08-17-*  # 12 change-id dirs
│   ├── state/TODO.md + MILESTONE.md + TODO.md
│   └── testing/                   # frontend testing standard docs
├── frontend/                      # React + TS + Vite + three.js memory pipeline demo
│   └── (102 entries; own package.json)
└── todo/                          # machine-readable task list backing docs/state/TODO.md
```

## Build & Install

```bash
# From the rules directory
cd /Volumes/code/workspace/foundation/axi-rules

# Combined entry point
make rules                                       # rules-build + rules-validate + rules-guard

# Individual
python3 scripts/build-index.py                   # regenerate 3 JSON indexes + Markdown mirrors
python3 scripts/validate-index.py                # hard-check schema v2 + ≥ 12 rules + cross-refs

# Policy bundle (Node consumers)
pnpm install                                     # or `npm install` for `axi-rules-bundle-tooling`
pnpm build-policy-bundle                         # → policy.bundle.json
pnpm test:policy-bundle                          # 10 node --test cases
pnpm lint:policy-bundle                          # strict build (exit 1 if any rule missing fields)
pnpm check-inline-rules                          # groups inline ### AR-* headings per module

# Handoff mechanical gate
python3 scripts/handoff-workflow.py --project-id <id> --mode edit
python3 scripts/handoff-workflow.py --project-id <id> --mode readiness
python3 scripts/handoff-workflow.py --require-edit-allowed --file-path <path>
python3 scripts/install-handoff-edit-gate.py     # wire Claude PreToolUse hard block
python3 scripts/test-handoff-workflow.py --self-test

# Frontend
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
pnpm --dir frontend e2e

# Audit
python3 scripts/audit-frontend-testing.py --all --strict
python3 scripts/test-claude-noninteractive.py    # full weak-prompt regression (NOT --prepare-only)
```

工作区治理路径为 `/Volumes/code/workspace/foundation/axi-rules`。仓库已在 `workspace.json` 注册为 `axi-rules`（tier=axi-core-product, domain=agent-rules），并在 `workspace.graph.json` 中列出消费者 `axi-agent`、`axi-workbench`、`axi-coder`、`axi-feishu-codex-bridge`（按 FR-7 / AC-7）。

## Verification

```bash
# Rule + index surface (authoritative for this repo)
make rules

# Frontend surface (when frontend/ changed)
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build

# Bridge / RAG consumer change (AR-ROUTING-002)
python3 scripts/test-claude-noninteractive.py

# Workspace governance
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project handoff-check axi-rules
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
```

按 `AGENTS.md § Verification`："Choose commands from the changed surface;
command lists are not cumulative unless the diff touches multiple surfaces."
仅修改 rule/index/docs 的 diff **不应** 因为命令出现在 workspace 元数据里就运行 frontend typecheck/test/build。

## Architecture Highlights

**四层模型（PRD §2 / `.claude/ARCHITECTURE.md`）**。L0 生成的 indexes（`index/*.json`、`policy.bundle.json`、`index/task-execution-routing.v1.json`）是机器可读的事实源；L1 规则文档（`rules/<cat>/AR-*.md`）是人类可读事实源；L2 类别模块（`rules/<cat>/AGENTS.md`）是恰好拥有一个类别的语义边界；L3 入口（`INDEX.md`、`AGENTS.md`、`README.md`、`Makefile`）是 agent + 人类入口合约。依赖单向 **L3 → L2 → L1 → L0**；反向引用 = 索引漂移。

**索引为生成产物，不可手编辑**。`scripts/build-index.py` 是索引再生的唯一来源；它遍历 9 个工作区分区（`foundation`、`workbench`、`agent-cluster`、`products`、`candidates`、`distributions`、`tools`、`references`、`archive`），对 `axi-rules` 与其他策展条目施加 `PROJECT_OVERRIDES`，解析每个项目的文档入口（`AGENTS.md`、`README.md`、`INDEX.md`、`TODO.md`、`MILESTONE.md`、`PRD.md`、`TDD.md`、`.claude/PARADIGM.md`、`.claude/ARCHITECTURE.md`），并发出 `index/projects.json`、`index/rules.json`、`index/sources.json`、`index/docs-source.json`，以及 Markdown 镜像。`EXCLUDED_NAMES` 携带 `.omx`、`.git`、缓存、`node_modules`、`__pycache__`、`downloadtemp`、`codex-plus-app`、`photo-sort-*` 等。`DOC_ENTRYPOINTS_REQUIRED = (AGENTS.md, README.md, INDEX.md)`。`axi-rules` 的 per-project overrides 声明其 stack（`Markdown, JSON, Python, React, TypeScript, Vite, three.js`）以及 verification matrix（`validate-index.py`、`pnpm --dir frontend test/typecheck/build`）。

**Rule Compiler（`policy.bundle.json`）**。`scripts/build-policy-bundle.py` 遍历 `rules/*/AR-*.md`（解析 YAML frontmatter，对 `KNOWN_MISSING_FRONTMATTER_IDS` 列出的 9 个已知旧版 verification 文件回退到 `# AR-XXX-NNN` Markdown 标题），然后遍历 `rules/*/AGENTS.md` 中的 `### AR-*` inline 标题，把每条 ID 规则发出到 `policy.bundle.json`（schema `policy.bundle/v1`、`policyVersion=governance-policy/v1`、`compilerVersion=1.0.0`）。bundle content hash 是 `sha256(json.dumps(payload_without_hash, sort_keys=True, ensure_ascii=False))`；`bundleId` 与 `compiledAt` 位于 hashed payload 之外，使两次连续 rebuild 在相同语料下总是产出同一 hash。`CATEGORY_PRECEDENCE` 排序 Guard Runtime 评估顺序（safety > routing > agent-routing > git-automation > cicd > handoff > lifecycle > verification > memory > project-bootstrap > development-sop > prd-format > project-display > codex-tooling > workflow > change > fallback > bridge）。safety 类别默认 effect 是 `deny`；其它默认 `allow`。10 用例 `policy-bundle-contract.test.mjs` Node `--test` 套件断言 rebuild 间确定性、rule 形态、排序优先级、id 唯一性、missing-frontmatter 列表匹配（9 个已知 legacy）以及 inline-rule 计数。首次发射：173 rules；bundleHash `1d32df6fa85249363f45bbe96d967138ec352f72e38ade13604d0174f2140cb5`。

**Source precedence（rank 1–5）**。`index/sources.json` 声明 `axi-rules.sources.v1`：rank 1 = `system_developer_user`（purpose："non-local instructions + current user intent"）；rank 2 = `axi-rules`（"local agent constraints, project routing, memory, verification, safety"）；rank 3 = `local-codex-memory`（"continuity, durable preferences, prior decisions"）；rank 4 = `axi-docs`（"fallback documentation when axi-rules has no answer"）；rank 5 = `live-workspace-inspection`（"current-state verification when indexes or docs are stale"）。`bridge_rag.exclude_runtime_dirs` 镜像 `EXCLUDED_NAMES`；`prefer_json_namespaces: ["axi-rules-index"]`；`semantic_markdown_namespaces: ["axi-rules", "codex-memory", "axi-docs"]`；`fallback_namespace: "axi-docs"`。`workspace_handoff` 块携带 `defaultLocalPath=/Volumes/code/workspace/.workspace/project-handoff.json`、`expectedMaxAgeHours=168`（7 天）、`localPathEnv=AXI_WORKSPACE_HANDOFF_PATH`、`schemaVersion=2026-06-11`、`validationCommand="python3 /Volumes/code/workspace/scripts/workspace-project handoff --json > {path} && python3 scripts/validate-index.py"`。

**Task-execution-routing v1（workflow-first，Agent 作为 bounded executor）**。`scripts/task_execution_routing.py:policy_document()` 是 `index/task-execution-routing.v1.json` 的确定性来源。Routes：`workflow`（`path_enumerable=True` → `enumerable_path` reasonCode，允许 `fixed_workflow_steps`）；`bounded_agent`（`local_path_unenumerable=True AND read_only=True` → `read_only_open_exploration`，允许白名单只读工具 + 沙箱 + bounded budget）；`escalate`（任何 `requests_command / requests_write / requests_external_side_effect / requests_privilege_escalation` → `command_requested / write_requested / external_side_effect_requested / privilege_escalation_requested` reason codes；fallback `unknown_request`）。`control_flow_owner: "workflow-engine"` —— **route 由 workflow engine 拥有，而非 model 或 Agent runtime**。由 `rules/agent-routing/AGENTS.md` 的 `AR-ROUTING-006` 链接。

**Handoff workflow mechanical gate（AR-HANDOFF-004）**。`scripts/handoff-workflow.py` 运行 9 步 gate 并发出 `HANDOFF_PACKET{ok, edit_allowed}`。Claude PreToolUse hook（`scripts/hooks/claude-pretool-edit-gate.py`）通过 `scripts/install-handoff-edit-gate.py` 安装并接入工作区 `.claude/settings.json`。`python3 scripts/handoff-workflow.py --require-edit-allowed` 硬阻塞未授权 project id 的 Write/Edit。`scripts/test-handoff-workflow.py --self-test` 覆盖 allow/deny 路径。

**Memory-source-precedence vs project-level scope**。仓库区分 "axi-rules answer"（rank 2 —— 按 `AR-ROUTING-002` 在 bridge 回复中必须被引用）与 "bridge / RAG consumer"（rank 1–5，编码在 `index/sources.json`）。`axi-docs` **仅作为 fallback rank 4** —— 不可用于覆盖任何 `axi-rules` 答案。

**Tool / command boundaries**。`.claude/PARADIGM.md § Tool / Command Boundaries` 列出 deny / confirm 列表。Deny（即便显式用户确认也不运行）：对 `/`、`~`、`$WORKSPACE_ROOT`、`.git` 的递归删除；对 `main` / `master` / release 分支的 `git push --force`；`chmod -R 777`；沙箱外的 `chown -R`；对未经验证 URL 的 `curl | sh` / `wget | bash`；对非 scratch DB 的 `DROP DATABASE / DROP TABLE`；`kill -9 1`；`mkfs`；向设备的原始 `dd`；对不可信输入的 `eval $(...)`。Confirm（仅在 `AskUserQuestion` 返回明确 yes 后运行）：`git rebase -i`；`git reset --hard`；`git clean -fd` / `git clean -fdx`；对 feature 分支的 `git push --force-with-lease`；覆盖 `axi-rules/` 之外已跟踪文件的 Write；对外部服务的 HTTP `POST/PUT/DELETE/PATCH`；任何 deploy 或 publish。完整 per-command 理由见 `rules/safety/AGENTS.md#ar-safety-002--tool--command-boundaries`。

**Change protocol（AR-CHANGE-001）**。任何改变 agent 可见行为、workflow 或 validation 的 commit 必须同时更新 **两个** `CHANGE.md`：根目录 `## Unreleased`（开发向）和最近的 feature/module 级 `CHANGE.md`（如 `frontend/CHANGE.md` for 前端变更）。单行 commit 消息 "Update CHANGE.md per AR-CHANGE-001" 即可。

**13 个类别模块**。每个模块恰好拥有一个类别；L2 合约由 `scripts/guard-all-categories-have-agents-md.py` 强制。已在 `PARTITION_BY_CATEGORY` 中映射的类别名：`agent-routing`、`memory`、`verification`、`safety`、`routing`、`change`、`handoff`、`lifecycle`、`project-bootstrap`、`development-sop`、`git-automation`、`cicd`、`codex-tooling`、`prd-format`。`workspace-discovery` 于 2026-06 加入。

## Key Modules/Files

| File | Purpose |
| --- | --- |
| `INDEX.md` | Fast Path table + 13-category rule index + lifecycle artifact index + 10 ADR cross-refs |
| `AGENTS.md` | Root operating model + 90-second read order + boundaries (system precedence, edit constraints, request defaults, verification matrix) |
| `README.md` / `README.zh-CN.md` | Purpose + Non-goals |
| `PRD.md` | L2 PRD v1.1, 271 lines; FR-1…FR-8 + AC-1…AC-8; self-references `rules/prd-format/AGENTS.md` |
| `CHANGE.md` | 8.7 KB root behavior / workflow / validation log (newest-first under `## Unreleased`) |
| `CHANGELOG.md` | Keep a Changelog [Unreleased] section |
| `MILESTONE.md` | M1 active / M2 pending / M3 pending + 9-category SOP snapshot |
| `.claude/PARADIGM.md` | L1 paradigm (precedence, operating model, change protocol, deny/confirm lists) |
| `.claude/ARCHITECTURE.md` | L2 architecture (L1/L2/L3 layering, index contracts, sync rules, L3 module references) |
| `rules/agent-routing/AGENTS.md` | AR-ROUTING-001..017 (240 LOC); includes AR-ROUTING-006 (control flow owns the workflow engine) |
| `rules/handoff/AGENTS.md` | AR-HANDOFF-001..015 (418 LOC); 90-second read order, manifest v2, stale evidence, project-modification workflow |
| `rules/safety/AGENTS.md` | AR-SAFETY-001..010; secrets, destructive work, runtime exclusions, deny/confirm lists |
| `rules/git-automation/AGENTS.md` | AR-GIT-001..010 (383 LOC); auto commits, feature grouping, submit logs, conditional push |
| `rules/lifecycle/AGENTS.md` | AR-LIFECYCLE-006..014 (207 LOC); change sizing, PRD/DESIGN/TASK gates, lifecycle artifacts |
| `rules/development-sop/AGENTS.md` | AR-DEVELOP-* (138 LOC); task boundaries, diff checks, tests, migrations |
| `rules/project-bootstrap/AGENTS.md` | AR-BOOTSTRAP-* + AR-CONFIG-PORT-INTENT-001 (203 LOC); new project 0-1 readiness, minimum agent-readable files |
| `rules/verification/AGENTS.md` | AR-VERIFY-001..003 + 29 AR-VERIFICATION-* (365 LOC); evidence, behavior-first frontend testing, completion claims |
| `rules/prd-format/AGENTS.md` | AR-PRD-FORMAT-001..005 (154 LOC); L2 PRD template v1.1 inheritance, layered concept, quantitative FR, module closure |
| `scripts/build-index.py` | 3,587 LOC; single source for index regeneration (`index/{projects,rules,sources,docs-source}.json`) |
| `scripts/validate-index.py` | 900 LOC; hard-check schema v2, ≥ 12 rules, ID cross-refs, doc entrypoints, shared consumer map |
| `scripts/build-policy-bundle.py` | 607 LOC; Rule Compiler → `policy.bundle.json` (deterministic sha256) |
| `scripts/policy-bundle.schema.json` | JSON Schema for bundle envelope + rule shape + `stats` block |
| `scripts/policy-bundle-contract.test.mjs` | 10 Node `--test` cases (determinism, shape, sort precedence, id uniqueness) |
| `scripts/handoff-workflow.py` | 864 LOC; AR-HANDOFF-004 9-step mechanical gate; emits `HANDOFF_PACKET{ok, edit_allowed}` |
| `scripts/install-handoff-edit-gate.py` | Wire Claude PreToolUse hook into workspace `.claude/settings.json` |
| `scripts/hooks/claude-pretool-edit-gate.py` | Hard-block Write/Edit for unauthorised project ids |
| `scripts/task_execution_routing.py` | Deterministic policy source (no model call) |
| `scripts/audit-frontend-testing.py` | 425 LOC; behavior-first frontend testing audit |
| `scripts/test-claude-noninteractive.py` | 738 LOC; weak-prompt regression (full pass required; `--prepare-only` is diagnostic-only) |
| `scripts/test-handoff-workflow.py` | 335 LOC; `--self-test` covers allow/deny paths |
| `scripts/test-validate-index-state-transitions.py` | 695 LOC; index state transition regression |
| `scripts/guard-all-categories-have-agents-md.py` | 61 LOC; enforces every rule module has `AGENTS.md` |
| `scripts/check-inline-rules.py` | 89 LOC; importable helper grouping inline AR-* headings |
| `scripts/split-registry.py` / `find-my-skill.sh` / `build-registry.sh` | Registry split + skill discovery utilities |
| `Makefile` | `make rules` (rules-build + rules-validate + rules-guard) |
| `policy.bundle.json` | 158 KB; 173 rules; bundleHash `1d32df6f…` |
| `index/projects.json` | canonical workspace project routing mirror (`axi-rules.project-index.v2`) |
| `index/rules.json` | rule metadata mirror (`axi-rules.rule-index.v2`; 3,589 LOC JSON; 173 rules) |
| `index/sources.json` | source precedence mirror (`axi-rules.sources.v1`; rank 1–5) |
| `index/task-execution-routing.v1.json` | workflow-engine policy; deterministic source-of-truth |
| `index/fallbacks.md` | human-readable fallback order (rank 1–5) |
| `docs/HANDOFF.md` | 90-second read order + contracts (readiness=`verified`, last verified 2026-09-25) |
| `docs/specs/templates/` | lifecycle artifact templates |
| `docs/specs/` | 12 change-id dirs (`2026-06-13-*` … `2026-08-17-*`) |
| `frontend/` | React + TS + Vite + three.js memory pipeline demo (102 entries; own `package.json`) |
| `package.json` | `axi-rules-bundle-tooling` (Node 20+); scripts: `build-policy-bundle`, `test:policy-bundle`, `lint:policy-bundle`, `check-inline-rules` |

## Milestone Status

`MILESTONE.md`（audit-remediation 2026-09-25 脚手架，owner 维护）。当前阶段：`shared`。三个里程碑：

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | Handoff-check closed loop (documented / verified) | active |
| M2 | PRD enters real content phase (replace stub, ≥ 1 observable AC) | pending |
| M3 | Next lifecycle stage advancement per `project-lifecycle-and-release.md` | pending |

**SOP snapshot（2026-09-26，当 `index/rules.json` count 变化 ±5 时重新生成）**：9 SOP categories（164 rules，13 categories）。其余 4 categories（`verification` 29 / `safety` 10 / `memory` 12 / `agent-routing + routing + change + codex-tooling + cicd` 34）属于 **discipline 或 configuration categories，不是可执行 workflow**。

| # | Category | Rule family | Entry |
|---|---|---|---|
| 1 | Admission | `AR-BOOTSTRAP-ADMISSION-001..006` + `AR-BOOTSTRAP-AFTER-001` | `rules/project-bootstrap/AGENTS.md` |
| 2 | Incubate | `AR-BOOTSTRAP-INCUBATION-006` | `rules/project-bootstrap/AGENTS.md` |
| 3 | Handoff | `AR-HANDOFF-001..015` | `rules/handoff/AGENTS.md` + `scripts/handoff-workflow.py` |
| 4 | Audit | `AR-HANDOFF-003` stale evidence | `templates/workspace-audit-remediation-trigger.md` + `workspace-audit.mjs` |
| 5 | Promote | `AR-LIFECYCLE-011` promote segment | `rules/lifecycle/AGENTS.md` |
| 6 | Archive | ADR-008 topology + `archive/` partition | `docs/adr/ADR-008-*` |
| 7 | Git | `AR-GIT-001..010` (incl. AR-GIT-010 added 2026-09-26) | `rules/git-automation/AGENTS.md` |
| 8 | Lifecycle stages | `AR-LIFECYCLE-001..014` (PRD → DESIGN → TASK → DEV → TEST → REVIEW → INTEGRATION) | `rules/lifecycle/AGENTS.md` |
| 9 | Development SOP | `AR-DEVELOP-*` + legacy `AR-DEV-SOP-001..003` | `rules/development-sop/AGENTS.md` |

**分支状态**（来自 `git status -sb`）：在 `dev` 上，领先 `origin/dev` 5 commits。最新 commit `f7a1f43 chore(index): absorb rules-regen from P2-A Cargo.lock exemption addition`（2026-09-30）。其它近期工作：`f12f5f6 docs(rules+adr): close-out Cargo.lock commit-policy drift per 2026-09-30 audit`；`a844785 docs(rules): align ADR-010 with ADR-011~019 namespace + add §7 integration log`；`19da687 docs(adr): add ADR-010 rust workspace backend strategy`；`425fa83 feat(rules): add Rule Compiler emitting policy.bundle.json`；`e2659f1 docs(rules): add AR-VERIFICATION-OBSERVABILITY-001 unified observability rule`；`d65345a fix(rules): extract cc-switch port candidates to AR-CODEX-003 to clear port-audit finding`；`9b25188 docs(prd): upgrade axi-rules PRD to v1.1 template (8th project in migration cohort)`；`9125676 sync axi-rules index + rules (excluding 2 hardcoded-port index files)`。4 个未跟踪的 `docs/logs/submit/2026*.md` 自动提交日志文件。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-rules/AGENTS.md) — root operating model；90-second read order；boundaries；request defaults；verification matrix；gotchas (NOT hand-edit `index/*.json`; AR-XXX-NNN ID pattern)。
- [`INDEX.md`](/Volumes/code/workspace/foundation/axi-rules/INDEX.md) — Fast Path table + 13-category rule index + lifecycle artifact index + 10-ADR cross-ref。
- [`README.md`](/Volumes/code/workspace/foundation/axi-rules/README.md) — purpose、generated indexes list、rule modules list、zero-context handoff commands。
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-rules/PRD.md) — L2 PRD v1.1（self-references `rules/prd-format/AGENTS.md`）。
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-rules/CHANGE.md) — 8.7 KB behavior / workflow / validation log。
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-rules/CHANGELOG.md) — Keep a Changelog [Unreleased]；Rule Compiler / bundle schema / contract suite added。
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-rules/MILESTONE.md) — M1 active / M2 pending / M3 pending + 9-category SOP snapshot。
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-rules/TODO.md) — short task tracker。
- [`.claude/PARADIGM.md`](/Volumes/code/workspace/foundation/axi-rules/.claude/PARADIGM.md) — precedence + operating model + change protocol + deny/confirm lists。
- [`.claude/ARCHITECTURE.md`](/Volumes/code/workspace/foundation/axi-rules/.claude/ARCHITECTURE.md) — L2 architecture；index contracts；sync rules。
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-rules/docs/HANDOFF.md) — 90-second read + commands + contracts（readiness=verified，last verified 2026-09-25）。
- [`docs/specs/templates/`](/Volumes/code/workspace/foundation/axi-rules/docs/specs/templates/) — lifecycle artifact templates。
- [`docs/specs/`](/Volumes/code/workspace/foundation/axi-rules/docs/specs/) — 12 change-id dirs（`2026-06-13-*` … `2026-08-17-*`）。

## Cross-References

- `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-001..010` — ADR-001（governance repo as index plane）、ADR-002（progressive naming）、ADR-003（workspace root is non-git）、ADR-004（APM agent context）、ADR-005（Agent BFF）、ADR-006（gateway taxonomy）、ADR-007（naming alias）、ADR-008（Personal OS repository topology）、ADR-009（workflow-first bounded agent）、ADR-010（Axi observability）。
- `/Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs` — workspace registry backing the source-precedence contract。
- `/Volumes/code/workspace/foundation/axi-runtime` — consumer；AGENTS.md imports `rules/agent-routing/AGENTS.md` for project-routing。
- `/Volumes/code/workspace/foundation/axi-kernel` — consumer；`kernel_bridge.py` writes Kernel v6 `Change` rows consumed by Axi Runtime。
- `/Volumes/code/workspace/foundation/axi-apps` — peer；consumes the same `axi-kernel` via `kernel_bridge.py`。
- `/Volumes/code/workspace/foundation/axi-sync` — peer；mirrors `inferrer.score` band table referenced by `axi-runtime`'s `_local_score`。
- `/Volumes/code/workspace/foundation/axi-ui` — consumed by `AR-ROUTING-007`（must read `docs/INTEGRATION.md` before wiring any new `@axi/*` consumer）。
- `/Volumes/code/workspace/foundation/axi-workspace-governance` — provides `axi-workspace-governance` capability per FR-7 consumers list（`axi-agent`、`axi-workbench`、`axi-coder`、`axi-feishu-codex-bridge`）。
- `/Volumes/code/workspace/foundation/axi-rules/index/projects.md` lists 36 projects across 9 partitions：`agent-cluster`、`archive`、`distributions`、`foundation`、`incubator`、`infra`、`products`、`references`、`tools`、`workbench`。
- `/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md` — sibling ADR to ADR-010（kernel contract）and ADR-011（`axi-kernel-rs`）；references `axi-rules` rank-2 authority in its 4-phase migration plan。

## 说明

`axi-rules` 是工作区规则索引 + memory-source-precedence + task-routing policy v1。仓库为声明式 Markdown 规则 + 13 category modules（`rules/*/`） + 3 个生成 JSON indexes（`index/projects.json`、`index/rules.json`、`index/sources.json`，schema v2），不是 runtime rules engine。`scripts/build-index.py`（3,587 LOC）+ `scripts/validate-index.py`（900 LOC）按 schema v2 校验 ≥ 12 rules、ID cross-refs、doc entrypoints。Rule Compiler `scripts/build-policy-bundle.py` 输出 `policy.bundle.json`（158 KB；schema `policy.bundle/v1`、`policyVersion=governance-policy/v1`；bundleHash `1d32df6f…`，确定性 sha256）；`scripts/policy-bundle-contract.test.mjs`（10 个 `node --test`）保证确定性 + rule shape + sort precedence + id 唯一性。`index/sources.json` 声明 5 级 source precedence（rank 1 `system_developer_user`、rank 2 `axi-rules`、rank 3 `local-codex-memory`、rank 4 `axi-docs`、rank 5 `live-workspace-inspection`）；`index/task-execution-routing.v1.json` 由 `scripts/task_execution_routing.py:policy_document()` 确定性生成，区分 `workflow` / `bounded_agent` / `escalate` 三种 routes，控制流由 workflow engine 拥有。`scripts/handoff-workflow.py`（AR-HANDOFF-004，864 LOC）+ Claude PreToolUse hook（`scripts/hooks/claude-pretool-edit-gate.py`）守护 handoff 9 步机械 gate；`scripts/test-claude-noninteractive.py`（738 LOC）作为 weak-prompt 回归，但 `--prepare-only` 仅用于诊断。`make rules` 是 `rules-build` + `rules-validate` + `rules-guard` 的统一入口；rule/index/docs 的 diff 不应触发 `pnpm --dir frontend typecheck/test/build`。消费方：FR-7/AC-7 列出 `axi-agent`、`axi-workbench`、`axi-coder`、`axi-feishu-codex-bridge`。