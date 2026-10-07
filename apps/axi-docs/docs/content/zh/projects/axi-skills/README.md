---
id: axi-docs-zh-projects-axi-skills
title: Axi Skills
type: project
status: published
tags: [Axi Docs, 项目, foundation, shared-skill-catalog]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Skills
graph-tags: [Projects, foundation, shared-skill-catalog]
description: Shared, version-controlled skill catalog for Axi agents (Codex, Claude, Cursor, MiniMax, OpenCode, Gemini, Copilot, .agents/skills). Provides the codex-skill-catalog, apm-agent-context-package, and skill-i18n-batch-contract surfaces, plus zero-context bootstrap and Chinese intent routing.
project:
  id: axi-skills
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-skills
  source-section: shared
---

# Axi Skills

> 项目根 `README.md` 和 `INDEX.md` 镜像。事实源：
> [`/Volumes/code/workspace/foundation/axi-skills/README.md`](/Volumes/code/workspace/foundation/axi-skills/README.md)、
> [`/Volumes/code/workspace/foundation/axi-skills/INDEX.md`](/Volumes/code/workspace/foundation/axi-skills/INDEX.md)。
> Section: shared-skill-catalog / Partition: `foundation/`。

## Summary

`axi-skills` 是 Axi 兼容 agent 的共享、版本可控的 skill 树。它对外暴露一个运行时事实源（`skills/`），被 Codex、Claude、Cursor、MiniMax、OpenCode、Gemini、Copilot 与 `.agents/skills` 兼容运行时共同读取，不再各自维护漂移副本。当前目录包含 **880 个 `SKILL.md` 文件**，被视为 **cold storage**：agent 在启动时加载一个 workflow OS（L1）加上 stage-gated feature 插件（L2）；`docs/SKILL_INDEX.md` 仅用于 `grep` 查询，绝不能热加载。仓库还交付 APM zero-context bootstrap 合约（`apm.yml` + `.apm/instructions/*`）、针对本地化 `skills.zh/` 镜像的由 verifier 守护的 i18n batch 合约，以及用于 global skill-root 切换的安装器。

**Stage**：shared foundation，stage `shared` per `MILESTONE.md`。
**Canonical path**：`/Volumes/code/workspace/foundation/axi-skills`。
**APM version**：`0.1.0`（`type: hybrid`，`targets: 7`）。
**Working tree**：在 `dev` 上领先 `origin/dev` 3 commits（ZCode agent-pool 编排与 macOS pressure admission 在途）。

分支策略：`main` 承载可发布构建；`dev` 承载日常集成。初始导入来自 `/Users/mose/.agent-skills/skills`，并通过 `scripts/sync-from-global.sh`（默认 dry-run；`--apply` 触发变更）保持同步。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Skill format | Markdown with YAML frontmatter (`name`, `description`, optional `metadata.aliases`, `metadata.catalog`) | Entry point must be named `SKILL.md` |
| Bootstrap | `axi-zero-context` + `axi-skill-router` + 2 `.apm/instructions/*` files | APM installs the bundle via `apm.yml` `includes` |
| Verifier (runtime tree) | `python3 scripts/verify.py` (298 lines) | Frontmatter parse, secret-pattern / GitHub-100MB guards, forbidden-dir checks, `INDEX.md` regen |
| Verifier (i18n scaffold) | `python3 scripts/verify_i18n.py` (396 lines) | Manifest, fence / URL / inline-backtick / UPPER_SNAKE_CASE / protected-token invariants |
| Batch generator | `python3 scripts/build_batches.py` (115 lines) | Disjoint batches; large files (>=20 KB) get their own batch; ~20 paths per normal batch |
| Installer | `bash scripts/install-global-links.sh`, `bash scripts/sync-from-global.sh` | Dry-run by default; `--apply` mutates agent runtimes |
| Translation workers | `scripts/agents/translate-batch.sh`, `scripts/parallel_translate.py`, `scripts/batch_translate.sh`, `scripts/rebuild_zh.py` | Delegated to a dedicated worker, not the main agent |
| Tests | `python3 scripts/test_skill_loading_policy.py`, `python3 scripts/test_skill_router.py`, `python3 scripts/test_workspace_commit_batch.py`, `python3 scripts/test_minimax_direct_route.py` | Smoke tests for the loading policy and router |
| Migration | `docs/MIGRATION.md` + `scripts/install-global-links.sh` | Manages `~/.agent-skills/skills`, `~/.agents/skills`, `~/.codex/skills` (overlay), `~/.claude/skills`, `~/.cursor/skills`, `~/.minimax/skills` |
| Chinese commands | `commands/claude/` (linked to `~/.claude/commands/`) | `/提交`, `/审计`, `/更新`, `/技能` dispatch into `axi-skill-router` |

## Project Layout

```text
axi-skills/
├── apm.yml                       # APM package manifest, 7 targets, hybrid type
├── AGENTS.md / AGENTS.zh-CN.md   # agent rules, i18n layout, verifier, relationship metadata
├── README.md / README.zh-CN.md   # layout, verification, sync, link setup
├── INDEX.md                      # authoritative document map (read order + contracts)
├── CHANGE.md                     # pointer to docs/state/CHANGELOG.md
├── CHANGELOG.md                  # canonical change log (Keep a Changelog)
├── MILESTONE.md                  # verified shared skill catalog acceptance criteria
├── TODO.md                       # active maintenance queue (SKILL_INDEX, i18n batches, cutover, APM)
├── skills/                       # English runtime source of truth (880 SKILL.md files)
│   ├── axi-zero-context/         # zero-context bootstrap
│   ├── axi-skill-router/         # Chinese intent dispatcher (/提交 /审计 /更新 /技能)
│   ├── axi-*-group-*             # 30+ Axi skill-group browsable skills
│   ├── .system/                  # system-area skills (imagegen, openai-docs, plugin-creator, ...)
│   └── (third-party + ecosystem skills)
├── skills.zh/                    # Chinese localized mirror (git-ignored; not runtime)
├── docs/
│   ├── APM.md                    # APM integration contract (source contract, consumer usage)
│   ├── MIGRATION.md              # global skill-root cutover, sync, rollback
│   ├── SKILL_INDEX.md            # generated catalog table (880 entries)
│   ├── i18n/
│   │   ├── README.md             # i18n guardrail contract, batching rules
│   │   └── batches/              # batch-001.txt .. batch-164.txt (one path per line)
│   ├── project-docs.manifest.json
│   └── HANDOFF.md
├── scripts/
│   ├── verify.py                 # English skill-tree validator + index regen
│   ├── verify_i18n.py            # i18n scaffold verifier
│   ├── build_batches.py          # regenerate docs/i18n/batches/batch-*.txt
│   ├── build_skill_groups.py     # rebuild axi-group-* browseable skills
│   ├── list_skill_group.py       # list skills in a given group
│   ├── regen_skill_index.py      # alternative index regenerator
│   ├── install-global-links.sh   # global runtime linker (dry-run by default)
│   ├── sync-from-global.sh       # legacy -> shared sync (dry-run by default)
│   ├── install_exe.sh            # reapply executable bits on runnable scripts
│   ├── agents/translate-batch.sh # delegated translation worker
│   ├── batch_translate.sh        # large-batch translation driver
│   ├── parallel_translate.py     # parallel translation runner
│   ├── preserve_fence_translate.py / realign_fences.py / fix_fences.py  # fence repair
│   ├── generate_zh_skill_families_fulltext.mjs / generate_zh_skill_titles_fulltext.mjs
│   ├── translate_i18n.py         # i18n driver
│   ├── rebuild_api_design.py / rebuild_zh.py / regen_skill_index.py
│   ├── repo_cleanup_chain.sh     # cleanup helper
│   ├── run_pending_batches.sh    # resume unfinished batches
│   ├── test_skill_loading_policy.py / test_skill_router.py
│   ├── test_workspace_commit_batch.py / test_minimax_direct_route.py
│   └── (verifier + tests)
├── commands/claude/              # Claude-only /提交 /审计 /更新 /技能 aliases
├── .apm/
│   └── instructions/
│       ├── axi-skill-loading-policy.instructions.md   # L0 bootstrap → L1 OS → L2 plugins
│       └── axi-workspace-routing.instructions.md      # always-on routing discipline
├── .githooks/                    # Git hooks (commit-time verification)
├── .github/                      # GitHub workflow files
├── .omx/                         # OMX harness artifacts
└── skills/.sync-manifest.json    # version-1 per-skill lastSyncedAt manifest
```

## Build & Install

```bash
# Setup (Python 3 required for verification)
python3 --version

# Synchronize the shared tree from the legacy global skill directory
scripts/sync-from-global.sh            # dry-run
scripts/sync-from-global.sh --apply    # mutate

# Cut over agent runtimes to read this repo
scripts/install-global-links.sh        # dry-run
scripts/install-global-links.sh --apply # backup legacy + link shared tree

# Optional: install the Chinese Claude commands
ln -sf "$(pwd)/commands/claude"/* ~/.claude/commands/
```

Consumer 也可以通过 APM 拉取 bundle：

```bash
apm install /Volumes/code/workspace/foundation/axi-skills --dry-run --target agent-skills
apm install /Volumes/code/workspace/foundation/axi-skills --target codex
```

## Verification

```bash
# Runtime skill-tree validator
python3 scripts/verify.py
python3 scripts/verify.py --write-index   # regenerate docs/SKILL_INDEX.md

# i18n manifest + translation invariants
python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff
python3 scripts/verify_i18n.py --paths-from docs/i18n/batches/batch-001.txt --forbid-english-diff
python3 scripts/verify_i18n.py --all --forbid-english-diff

# Batch manifest regen (after adding / removing / renaming skills)
python3 scripts/build_batches.py

# Smoke
python3 scripts/test_skill_loading_policy.py
python3 scripts/test_skill_router.py
```

runtime verifier 拒绝 `FORBIDDEN_DIRS`（`.git`、`__pycache__`、`.cache`、`.venv`、`venv`、`node_modules`、`dist`、`build`、`coverage`、`test-results`、`sessions`）、`SECRET_FILE_PATTERNS`（`*.env`、`*.pem`、`*.p12`、`*.pfx`、`id_rsa*`、`id_ed25519*`、`credentials.json`、`secrets.json`、`tokens.json`），以及 `SECRET_CONTENT_PATTERNS`（`-----BEGIN ... PRIVATE KEY-----`、GitHub tokens、OpenAI-style keys、AWS access keys，文档化的 `AKIAIOSFODNN7EXAMPLE` 占位符除外）。同时拒绝 ≥100 MB 的文件。

i18n verifier 强制（针对 English 文件）：

- mirror 在同一相对路径存在；
- `git diff --name-only -- skills` 为空（`--forbid-english-diff`）；
- YAML key set 一致；`name` byte-identical；`description` 在 English 有描述时必须不同；
- English body 非空时，body 长度 ≥ ~40 chars；
- fenced code-block 计数、URL multiset、inline backtick multiset 与 UPPER_SNAKE_CASE token multiset 全部一致；
- `API_KEY`、`OPENAI_BASE_URL`、`MINIMAX_TOKEN_PLAN_API_KEY` 受保护，不得删除或修改。

## Architecture Highlights

目录采用 **cold storage**：loading policy（`.apm/instructions/axi-skill-loading-policy.instructions.md`）定义了严格的三层 dispatch。**L0 bootstrap** 在 session start 时把 agent 路由到 `axi-project-admission`（任何 project-creation 意图）、再 `axi-zero-context`（takeover），然后选择 **一个** L1 workflow OS（audit 用 `workspace-audit-remediation`；zero-context 用 `axi-zero-context`；vague / large 用 OMX `autopilot`/`ralph`；web-product spec 用 gstack `gstack-spec`；multi-phase roadmap 用 GSD `gsd-progress`；single feature 用 `do`；bug / regression 用 `gstack-investigate`；research 用 `deep-research` 或 `best-practice-research`；bio / clinical DB lookups 用 vertical chain）。**L2 feature plugins** 是 stage-gated（`ENTER → CLARIFY → DESIGN → BUILD → VERIFY → SHIP`）—— stack skills 仅在 BUILD 时加载，design 在 DESIGN，verification 在 VERIFY，ship 在 SHIP。同一 stage 内每个 family 最多加载 **一个** skill（如 `react-best-practices` xor `vercel-react-best-practices`）。对 Axi tasks，always-on routing discipline 为 `.apm/instructions/axi-workspace-routing.instructions.md`：通过 `WORKSPACE_INDEX.md`、`workspace.graph.json` 或 `scripts/workspace-project` 解析 project identity；读取 project-local `AGENTS.md` / `CLAUDE.md` / `README.md`；不把 APM 作为 handoff / workspace-graph 合约的替代。

**Zero-context bootstrap** 位于 `skills/axi-zero-context/SKILL.md`："route first"（将 `/Volumes/code/workspace` 视为 workspace container，通过 `WORKSPACE_INDEX.md` / `workspace.graph.json` / `scripts/workspace-project` 解析身份）；"read the handoff"（project-local AGENTS.md、`docs/HANDOFF.md`、`docs/project-docs.manifest.json`，然后 `git status --short --branch`）；"map the surface"（product UI、backend、shared package、local tool、documentation、reference）；"use existing skills"（`axi-workspace-routing`、`codebase-onboarding`、`agentic-engineering`、`code-review`、`git-commit-batch`、`git-workflow`、`git-clean`）。APM 通过 `apm.yml` `includes` 暴露此 bootstrap，使全新 agent 环境可在 7 个支持的目标上安装同一 bundle。

**Chinese intent routing** 位于 `skills/axi-skill-router/SKILL.md`（frontmatter 声明 `aliases: /提交 /审计 /更新 /技能`、`catalog: docs/SKILL_INDEX.md`，以及 `chinese_titles: docs/i18n/zh-skill-title-candidates.jsonl`）。router 把 shortcut 当成 category，而非 authorization。它对 `docs/SKILL_INDEX.md` 与生成的 Chinese title / family 元数据运行 `python3 scripts/route_skill.py --alias "<alias>" --query "<user request>"`（`--json` 输出机器可读结果），返回 ranked candidates，最多展示三个，加载有副作用的 skill 前先询问 **一个** clarification 问题。得到答复后加载能覆盖请求的最小 skill 集合，并在不弱化其安全 / 验证规则的前提下遵循它们。

**APM zero-context package**（`apm.yml`）将 canonical `skills/` 树与两个 `.apm/instructions/*.md` 文件打包给 Codex、Claude、Cursor、OpenCode、Gemini、`.agents/skills`。它在 consumer 项目中生成 `apm.lock.yaml` 以保证可复现性，可在 agent context 进入 harness 之前运行 APM policy / audit 检查，但 **不会** 替代 project identity、handoff readiness 或 workspace graph 合约。Consumer 可运行 `apm install <path> --dry-run --target agent-skills` 做本地 preview 而不修改 harness 文件，或 `--target codex` 在真实 Codex config 中 materialize bundle。

**Skill-i18n batch 合约** 在 `skills.zh/`（git-ignored）保留 Chinese localized mirror，同时不让它成为 runtime source。每个 English `SKILL.md` 恰好被分配到 `docs/i18n/batches/` 下的一个 batch 文件；`scripts/build_batches.py` 把 `>20 KB` 的文件放到自己的 batch，其余按 ~20-path 成组（15–25 区间，尾部可能更小）。当前 **164 个 batch 文件**（batch-001 到 batch-164）。翻译工作委托给专门 worker（`scripts/agents/translate-batch.sh`、`parallel_translate.py`、`batch_translate.sh`），并由 `scripts/verify_i18n.py` 校验 frontmatter parity、body length、fenced-block / URL / inline-backtick / UPPER_SNAKE_CASE multisets，以及受保护 token（`API_KEY`、`OPENAI_BASE_URL`、`MINIMAX_TOKEN_PLAN_API_KEY`）。

**Global skill-root cutover** 由 `scripts/install-global-links.sh` 和 `docs/MIGRATION.md` 拥有。installer 管理 `~/.agent-skills/skills`、`~/.agents/skills`、`~/.codex/skills`（individual shared-skill overlay；保留 `.system`）、`~/.claude/skills`、`~/.cursor/skills`、`~/.minimax/skills`。它先移动真实 legacy global skill directory 到带时间戳的 backup，再链接 shared agent 入口到本仓库。Codex 的 user skill 入口是 `~/.agents/skills`；installer 还把 shared skills overlay 到 `~/.codex/skills`，但不替换该目录及其 `.system` 内容。`scripts/sync-from-global.sh` 提供反向（legacy → shared）同步，附显式 exclusion 列表，且仅删除 global tree 中已不存在的仓库文件（`--apply` 时生效）。

## Key Modules/Files

| Path | Role |
| --- | --- |
| `apm.yml` | APM package manifest (`version: 0.1.0`, `type: hybrid`, 7 targets, `includes: [axi-zero-context, axi-skill-router, axi-skill-loading-policy, axi-workspace-routing]`) |
| `skills/axi-zero-context/SKILL.md` | Zero-context workspace takeover: route → read handoff → map surface → use existing skills |
| `skills/axi-skill-router/SKILL.md` | Chinese intent dispatcher (`/提交 /审计 /更新 /技能`); routes via `scripts/route_skill.py` against `docs/SKILL_INDEX.md` |
| `skills/axi-*-group-*/SKILL.md` | ~30 Axi skill-group browsable skills (`axi-group-agent-orchestration`, `axi-group-backend-api`, `axi-group-bio-health-research`, `axi-group-frontend-ui`, etc.) |
| `skills/.sync-manifest.json` | `version: 1`, per-skill `lastSyncedAt` epoch (used by `sync-from-global.sh`) |
| `.apm/instructions/axi-skill-loading-policy.instructions.md` | L0 bootstrap → L1 OS → L2 stage-gated plugins; stack probe rules; cold-storage rules for `SKILL_INDEX.md` |
| `.apm/instructions/axi-workspace-routing.instructions.md` | Always-on routing: resolve through workspace registry, do not use APM as a replacement |
| `scripts/verify.py` | Frontmatter parse, secret-pattern / GitHub-100MB / forbidden-dir guards, index regen |
| `scripts/verify_i18n.py` | Manifest, fence / URL / inline-backtick / UPPER_SNAKE_CASE / protected-token invariants |
| `scripts/build_batches.py` | Disjoint batch generation; large files get their own batch |
| `scripts/build_skill_groups.py` | Rebuild `axi-group-*` browseable skills |
| `scripts/list_skill_group.py` | List skills in a given group |
| `scripts/regen_skill_index.py` | Alternative index regenerator |
| `scripts/install-global-links.sh` | Global runtime linker (dry-run by default; `--apply` mutates) |
| `scripts/sync-from-global.sh` | Legacy → shared sync (dry-run by default; `--apply` mutates) |
| `scripts/agents/translate-batch.sh` | Delegated translation worker |
| `scripts/batch_translate.sh` / `parallel_translate.py` | Large-batch translation drivers |
| `scripts/preserve_fence_translate.py` / `realign_fences.py` / `fix_fences.py` | Fence repair during translation |
| `scripts/test_skill_loading_policy.py` / `test_skill_router.py` / `test_workspace_commit_batch.py` / `test_minimax_direct_route.py` | Smoke tests |
| `docs/APM.md` | APM source contract, consumer usage, scratch-root preview |
| `docs/MIGRATION.md` | Global skill-root cutover, sync, rollback contract |
| `docs/SKILL_INDEX.md` | Generated 880-row catalog (886 lines) |
| `docs/i18n/README.md` | i18n guardrail contract, batching rules, verifier usage |
| `docs/i18n/batches/batch-001.txt` … `batch-164.txt` | One English `SKILL.md` path per line; disjoint |
| `docs/state/PRD.md` | Purpose, users, requirements, success criteria |
| `docs/state/TDD.md` | Verification surface (runtime catalog, i18n manifest, global link dry-run) |
| `docs/state/MILESTONE.md` | Verified shared skill catalog acceptance criteria |
| `docs/state/TODO.md` | Active maintenance queue (SKILL_INDEX sync, i18n batch sync, cutover, APM alignment) |
| `docs/project-docs.manifest.json` | v2 handoff manifest source |
| `docs/HANDOFF.md` | Zero-context handoff; readiness `stale` per `workspace-project onboard` |
| `commands/claude/` | `/提交`, `/审计`, `/更新`, `/技能` aliases linked to `~/.claude/commands/` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Verified shared skill catalog | Keep `axi-skills` registered as canonical, verified shared skill source | Active acceptance: `docs/project-docs.manifest.json` v2; `docs/HANDOFF.md` regenerated; `verify.py` exits 0; `verify_i18n.py --check-manifest-only --forbid-english-diff` exits 0; workspace graph + handoff registry include `axi-skills` |
| Zero-context bootstrap | `axi-zero-context` + `axi-workspace-routing` + `axi-skill-loading-policy` available through APM | Live (`apm.yml` includes; `scripts/install-global-links.sh` link path) |
| Chinese intent routing | `/提交 /审计 /更新 /技能` aliases + `axi-skill-router` for ambiguous intent | Live (`commands/claude/` + `skills/axi-skill-router` + `scripts/route_skill.py`) |
| Skill-i18n batch contract | `skills.zh/` mirror validated by 164 batches; English `SKILL.md` never mutated | Live (`verify_i18n.py` invariants); translation tail continues (latest commits `f0fdc39`, `0d89f14`, `bfdd138`, `54dbb61`, `60abd25`, `4715a07`, `47a2f64`) |
| Global skill-root cutover | `~/.agents/skills` + `~/.codex/skills` (overlay) + `~/.claude/skills` + `~/.cursor/skills` + `~/.minimax/skills` point at this repo | Documented (`docs/MIGRATION.md`); dry-run via `scripts/install-global-links.sh` |
| Skill-index regen | `docs/SKILL_INDEX.md` rebuilt from 880 SKILL.md entries | Live (`python3 scripts/verify.py --write-index`) |
| ZCode native agent-pool admission | macOS pressure admission + pool ledger + concurrency honest bookkeeping | In flight (commit `6a3684e` recorded scoped verification + runtime limits; `44908e5` ZCode pool invocation; `c9eaa33` native worker ledger) |
| Audit-remediation tail | `axi-skills` registry + auto-submit log snapshot | In flight (commits `d476360`, `f723cb1`, `a2243e1`, `1b364ff`, `9da82ea`, `d946aa3`, `6e57f13`, `aa04368`, `4738c76`) |

权威 acceptance 列表见 `docs/state/MILESTONE.md`，active maintenance queue 见 `TODO.md`。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-skills/AGENTS.md) — agent rules, cold-storage policy, i18n layout, verifier commands, relationship metadata
- [`README.md`](/Volumes/code/workspace/foundation/axi-skills/README.md) — repository layout, verification, sync, link setup, Chinese intent entry
- [`INDEX.md`](/Volumes/code/workspace/foundation/axi-skills/INDEX.md) — read order, contracts, find-my-skill workflow
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-skills/CHANGE.md) — pointer to `docs/state/CHANGELOG.md`
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-skills/CHANGELOG.md) — Keep a Changelog entries
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-skills/MILESTONE.md) — verified shared skill catalog acceptance
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-skills/TODO.md) — active maintenance queue
- [`apm.yml`](/Volumes/code/workspace/foundation/axi-skills/apm.yml) — APM package manifest
- [`docs/APM.md`](/Volumes/code/workspace/foundation/axi-skills/docs/APM.md) — APM source contract, consumer usage
- [`docs/MIGRATION.md`](/Volumes/code/workspace/foundation/axi-skills/docs/MIGRATION.md) — global skill-root cutover contract
- [`docs/SKILL_INDEX.md`](/Volumes/code/workspace/foundation/axi-skills/docs/SKILL_INDEX.md) — generated 880-row catalog
- [`docs/i18n/README.md`](/Volumes/code/workspace/foundation/axi-skills/docs/i18n/README.md) — i18n guardrail contract
- [`docs/i18n/batches/batch-001.txt` … `batch-164.txt`](/Volumes/code/workspace/foundation/axi-skills/docs/i18n/batches/) — translation batch manifests
- [`docs/state/PRD.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/PRD.md) — purpose, users, requirements, success criteria
- [`docs/state/TDD.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/TDD.md) — verification surface
- [`docs/state/MILESTONE.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/MILESTONE.md) — verified shared skill catalog acceptance
- [`docs/state/TODO.md`](/Volumes/code/workspace/foundation/axi-skills/docs/state/TODO.md) — active maintenance queue
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-skills/docs/HANDOFF.md) — zero-context handoff
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/foundation/axi-skills/docs/project-docs.manifest.json) — v2 handoff manifest source
- [`.apm/instructions/axi-skill-loading-policy.instructions.md`](/Volumes/code/workspace/foundation/axi-skills/.apm/instructions/axi-skill-loading-policy.instructions.md) — L0/L1/L2 dispatch contract
- [`.apm/instructions/axi-workspace-routing.instructions.md`](/Volumes/code/workspace/foundation/axi-skills/.apm/instructions/axi-workspace-routing.instructions.md) — always-on workspace routing discipline
- [`skills/axi-zero-context/SKILL.md`](/Volumes/code/workspace/foundation/axi-skills/skills/axi-zero-context/SKILL.md) — zero-context bootstrap
- [`skills/axi-skill-router/SKILL.md`](/Volumes/code/workspace/foundation/axi-skills/skills/axi-skill-router/SKILL.md) — Chinese intent dispatcher

## Cross-References

- Workspace root: `/Volumes/code/workspace/AGENTS.md`, `/Volumes/code/workspace/WORKSPACE_INDEX.md`
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance`
- Workspace registry / project graph: `/Volumes/code/workspace/workspace.graph.json`, `scripts/workspace-project list`
- Relationship metadata as a Provider — capabilities `skill-tree` (build), `apm-package` (build), `i18n-scaffold` (build), `skill-catalog` (runtime), `axiom-zero-context` (runtime), `skill-index` (runtime); requiredness `required`
- ADR references: `/Volumes/code/workspace/foundation/axi-rules/rules/project-bootstrap/AGENTS.md` (AR-BOOTSTRAP-ADMISSION-001 … AR-BOOTSTRAP-AFTER-001)
- Skill-index search: `bash ~/.claude/skills/scripts/find-my-skill.sh <keyword>` (`fms` alias); registry at `~/.claude/skills/SKILL_REGISTRY.md`
- Recent trajectory: `6a3684e` scoped ZCode pool verification + runtime limits; `44908e5` ZCode pool invocation + honest concurrency; `c9eaa33` pressure-aware native worker ledger; `ddcd948` private governance remote; `47a2f64` replace forbidden milestone term to satisfy audit; `f0fdc39` SKILL_INDEX refresh + maintain-axi-ui-docs + `axi-workspace-git-audit`; `bfdd138` + `54dbb61` i18n batches 001–163; `60abd25` restore missing zh-CN mirror tokens; `b0aa706` sync registry + scripts + skills docs

## 说明

`axi-skills` 是 Axi agents 的共享、版本可控 skill 树，路径 `/Volumes/code/workspace/foundation/axi-skills`。当前 880 个 `SKILL.md` 文件位于 `skills/`（**cold storage**：`docs/SKILL_INDEX.md` 仅 grep 查询，不得热加载）。三条 surface：`codex-skill-catalog`（`apm.yml` `type: hybrid`、`version: 0.1.0`、7 个 target）+ `apm-agent-context-package`（`.apm/instructions/axi-skill-loading-policy.instructions.md` + `axi-workspace-routing.instructions.md` 提供 L0 bootstrap → L1 OS → L2 stage-gated feature plugins 三层策略）+ `skill-i18n-batch-contract`（`skills.zh/` 镜像，git-ignored，由 `scripts/verify_i18n.py` 校验 frontmatter parity、body length、fenced-block / URL / inline-backtick / UPPER_SNAKE_CASE multisets 以及 `API_KEY`、`OPENAI_BASE_URL`、`MINIMAX_TOKEN_PLAN_API_KEY` 受保护 token）。`scripts/install-global-links.sh` + `docs/MIGRATION.md` 管理 `~/.agents/skills` + `~/.codex/skills`（overlay）+ `~/.claude/skills` + `~/.cursor/skills` + `~/.minimax/skills` 切换。Zero-context bootstrap 在 `skills/axi-zero-context/SKILL.md`（route → read handoff → map surface → use existing skills）；Chinese intent routing 在 `skills/axi-skill-router/SKILL.md`（`aliases: /提交 /审计 /更新 /技能`，通过 `scripts/route_skill.py` 对 `docs/SKILL_INDEX.md` + `docs/i18n/zh-skill-title-candidates.jsonl` 运行）。`commands/claude/` 把 `/提交 /审计 /更新 /技能` 链接到 `~/.claude/commands/`。Translation workers（`scripts/agents/translate-batch.sh`、`parallel_translate.py`、`batch_translate.sh`、`scripts/build_batches.py` 维护 `docs/i18n/batches/batch-001.txt` … `batch-164.txt` disjoint 批）专门承担翻译，main agent 不参与。`scripts/sync-from-global.sh` 提供反向同步，dry-run by default，`--apply` 触发变更。