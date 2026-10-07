---
id: axi-docs-en-projects-dbskill
title: dbskill
type: project
status: published
tags: [Axi Docs, Projects, references, reference, skills, knowledge-atoms]
created: 2026-10-07
modified: 2026-10-07
graph-title: dbskill
graph-tags: [Projects, references]
description: Third-party `dontbesilent2025/dbskill` (GitHub) reference checkout — 21-skill Anthropic Skills bundle (business / decision / content / learning) distilled from 12,307 tweets into 4,176 knowledge atoms plus a parallel `Skill知识包/` method library, with Bash + Python build pipeline.
project:
  id: dbskill
  partition: references
  path: /Volumes/code/workspace/references/short-term/dbskill
  source-section: reference
---

# dbskill

> Reference checkout. Source of truth:
> [`/Volumes/code/workspace/references/short-term/dbskill`](/Volumes/code/workspace/references/short-term/dbskill).
> Upstream: `github.com/dontbesilent2025/dbskill`. License: CC BY-NC 4.0.
> Partition: `references/`.

## Summary

DBSkill (`/Volumes/code/workspace/references/short-term/dbskill`) is a third-party, **skill-collection** reference: 21 individual Agent skills for business diagnosis, content creation, decision-making, and learning, distilled from 12,307 tweets of the `dontbesilent` author into 4,176 structured "knowledge atoms" plus a parallel `Skill知识包/` method library. Each skill is a self-contained directory under `skills/<skill-name>/SKILL.md` with a YAML frontmatter (`name`, `description`, plus a Chinese- and English-language trigger phrase) and a long-form Markdown body that instructs the Agent how to behave when the user types `/dbs-diagnosis` or `/dbs-decision` or `/dbs-xhs-title` etc. The package can be installed via `claude plugin marketplace add dontbesilent2025/dbskill` (Claude Code), `npx -y skills add dontbesilent2025/dbskill -g --all` (Codex / Claude Code), or as individual zip files for Trae Solo; the canonical Anthropic Skills spec is followed, and the build script (`tools/build-skills.sh`) packages each skill into a per-skill zip plus a master `dbskill-<version>.zip` grouped by usage scenario (必装入口 / 看商业问题 / 做内容 / 进阶-…).

For Axi, this is the most direct reference for **how to author a serious multi-skill bundle** — the structure that turns one person's method library into 21 reusable Agent skills, plus the methodology for going from a raw content corpus (12,307 tweets) to a curated JSONL atom database that other skills can query by `topic` / `type` / `confidence` / `skills`. Three patterns are worth lifting directly: (1) the **`/dbs` main-routing skill** which does nothing but classify user intent and dispatch to a single child skill — a clean reference for any Axi product that needs to expose many skills through one entry point; (2) the **four-layer decision directory structure** in `/dbs-decision` (`01_事实/` append-only, `02_规律/` slow-correction, `03_定格/` write-once snapshots, `04_待解/` clear-on-resolution) — a generally useful pattern for any long-running decision/intelligence layer in an Agent system; and (3) the **`dbs-agent-migration`** skill which encodes the exact `CLAUDE.md → AGENTS.md + skills/ + bridge` migration pattern that Axi itself has had to think through, with concrete rules for Grok TUI's `user_invocable: true` requirement.

The secondary lesson is **knowledge-atom authoring methodology**. `知识库/原子库/atoms.jsonl` is 4,176 JSONL rows, each with `id`, `knowledge` (distilled one-liner), `original` (≤200-char tweet), `url`, `date`, `topics` (10 categories), `skills` (which skills reference it), `type` (principle/method/case/anti-pattern/insight/tool), `confidence` (high/medium/low). `知识库/Skill知识包/` (15 method docs) ties related atoms into long-form method papers (`diagnosis_公理与诊断框架.md`, `benchmark_对标方法论.md`, `decision_结构与回填规则.md`, etc.), and `知识库/高频概念词典.md` is a 46-term glossary derived by frequency-counting atoms. The combination — atomic JSONL + method markdown + glossary — is a clean three-tier knowledge base that Axi could lift as a template for any domain that needs to be turned into Agent-ingestible form.

The checkout ships with very little Axi-side documentation (the Axi overlay is `AGENTS.md`, `VERSION`, `VERIFICATION.md`, `docs/project-docs.manifest.json`); the upstream `README.md` is the canonical product entry. The Axi overlay is intentionally light because the project is a "skill collection" with no Axi-owned code; verification is just the upstream build script.

## Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Skill format | Anthropic Skills spec (YAML frontmatter + Markdown body) | `name`, `description`, Chinese + English trigger phrases; slash-commands invoked via `/<skill-name>` (e.g. `/dbs-diagnosis`, `/dbs-decision`, `/dbs-xhs-title`) |
| Skill body | Markdown (long-form methodology) | Heaviest `dbs-content-system` (549 lines) with own `scaffold/`, `templates/`, `tools/`, `docs/`; `dbs-diagnosis` 516 lines; `dbs-xhs-title` 736 lines; `dbs-decision` 316 lines; `dbs-agent-migration` 357 lines; `dbs-learning` 382 lines; `dbs-good-question` 471 lines; `dbs-ai-check` 272 lines; main router `dbs` 92 lines |
| Skill count | 21 individual skill directories | `dbs/` (dispatcher) + 20 domain skills: `dbs-diagnosis`, `dbs-benchmark`, `dbs-content`, `dbs-content-system`, `dbs-hook`, `dbs-xhs-title`, `dbs-ai-check`, `dbs-slowisfast`, `dbs-action`, `dbs-deconstruct`, `dbs-goal`, `dbs-good-question`, `dbs-decision`, `dbs-save`, `dbs-restore`, `dbs-report`, `dbs-learning`, `dbs-chatroom`, `dbs-chatroom-austrian`, `dbs-agent-migration` |
| Knowledge atoms | JSONL (`知识库/原子库/atoms.jsonl`) | 4,176 rows + per-quarter splits `atoms_{2024Q4,2025Q1,…2026Q1}.jsonl`; fields: `id` (`{quarter}_{seq}` like `2024Q4_001`), `knowledge` (distilled one-liner), `original` (≤200-char source), `url`, `date`, `topics` (10 categories), `skills` (cross-reference), `type` (`principle`/`method`/`case`/`anti-pattern`/`insight`/`tool`), `confidence` (`high`/`medium`/`low`) |
| Method docs | Markdown (`知识库/Skill知识包/`) | 15 long-form papers: `diagnosis_公理与诊断框架.md`, `diagnosis_问题消解案例库.md`, `benchmark_对标方法论.md`, `benchmark_平台运营知识.md`, `content_内容创作方法论.md`, `content_平台特性与案例.md`, `action_心理诊断框架.md`, `action_信号案例库.md`, `deconstruct_语言与概念框架.md`, `deconstruct_解构案例库.md`, `decision_AI协作规则.md`, `decision_决策记录方法论.md`, `decision_概念炼出方法.md`, `decision_结构与回填规则.md`, `decision_隐私与代号机制.md` |
| Glossary | Markdown (`知识库/高频概念词典.md`) | 46 terms ranked by frequency |
| Decision rule (macOS + Windows) | Four-layer pattern from `dbs-decision/SKILL.md` | `01_事实/` (append-only) + `02_规律/` (slow-correction, `[修正 YYYY-MM-DD]` appended, original never rewritten) + `03_定格/` (write-once snapshots) + `04_待解/` (clear-on-resolution); each layer has `_这层放什么.md`; `我的当前状态.md` is the always-first-read entry; `SOURCE_OF_TRUTH.md` declares authority; `AGENTS.md` enforces discipline; 5 working modes (初始化 / 更新当前状态 / 决策立案 / 结果回填 / 状态画像); source-tag taxonomy (`[本人]` / `[AI 推测]` / `[AI 结论]` / `[AI 关键标注]` / `[AI 元记录]` / `[结果回填]` / `[修正]` / `[本人 反馈]` / `[XX → 本人 / YYYY-MM]`); concepts must satisfy 3-of-2门槛 before promotion to `02_规律/` (出现 3 次 / 解释多事实 / 有工具性) |
| Cross-host adapter (Claude / Codex / Grok) | `dbs-agent-migration` skill (357 lines) | Classifies project A/B/C/D by rules-layer completeness (`CLAUDE.md` + `AGENTS.md` + `SOURCE_OF_TRUTH.md` + `skills/`); classifies host landscape (Claude主 / Codex主/Grok主/三端都有/多端都不成体系); 4 migration phases (迁移审计 → 规则文件迁移 → 识别/建立 skill 真源 → 生成 bridge); Grok TUI constraint `user_invocable: true` mandatory in frontmatter; recommended bridges `~/.claude/skills/<name>/`, `~/.codex/skills/<name>/`, `~/.grok/skills/<name>/` pointing at project-local `skills/` truth source |
| Build pipeline | Bash + Python (`tools/build-skills.sh`, 190 lines) | `python3 - "$stage_dir" "$archive_path"` heredoc for zipping; `group_for()` case groups skills into 10 usage buckets (必装入口 / 看商业问题 / 做内容 / 进阶-内容工程 / 进阶-聊天室 / 进阶-状态管理 / 进阶-决策系统 / 进阶-Agent基建 / 进阶-学习 / 未分组); scans `SKILL.md` for inline `知识库/.../*.md` references via `grep -Eo '知识库/[^\`,。 、)]*\.md'` and copies referenced knowledge files alongside so each skill zip is self-sufficient; outputs `dist/skills/{group}/{skill}.zip` + top-level `dbskill-${VERSION}.zip` |
| Install entrypoints | `claude plugin marketplace add dontbesilent2025/dbskill` (Claude Code) / `npx -y skills add dontbesilent2025/dbskill -g --all` (Codex / Claude Code) / individual zip files (Trae Solo) | Anthropic Skills spec |
| Skill demo pipeline | `scripts/demo.tape` + `record-demo.sh` | VHS-style demo recorder; produces `demo.gif` |
| Skill-graph visualisation | `docs/skill-link-map.mmd` + `docs/skill-link-map.svg` | Mermaid map of skill relationships |
| Axi overlay | `AGENTS.md` + `VERSION` + `VERIFICATION.md` + `docs/project-docs.manifest.json` | Minimal-overlay shape for a "skill-collection" reference |
| Reference-overlay verification | `bash tools/build-skills.sh` → expect `dist/skills/`; `test -d dist/skills`; `for f in README.md README.zh-CN.md AGENTS.md VERSION docs/project-docs.manifest.json; do test -f ...` | Build-only verification; `AGENTS.md` notes there is no test suite for this reference project |

## Project Layout

```
dbskill/
├── AGENTS.md                        # Axi reference overlay
├── README.md / README.zh-CN.md      # upstream bilingual docs
├── VERSION                          # single-line version (v2.14.2 in checkout)
├── VERIFICATION.md                  # Axi overlay verification doc
├── LICENSE                          # CC BY-NC 4.0
├── VERSION
├── demo.gif                         # installation demo (326 KB animated)
├── skills/                          # 21 Agent skill directories
│   ├── dbs/                         # main router (92 lines)
│   ├── dbs-diagnosis/               # business model diagnosis (516 lines)
│   ├── dbs-benchmark/               # competitor benchmarking
│   ├── dbs-content/                 # content creation diagnosis
│   ├── dbs-content-system/          # content structuring system (549 lines, single-dir heavy)
│   │   ├── SKILL.md
│   │   ├── docs/                    # acceptance.md, quickstart.md
│   │   ├── scaffold/                # root/ + rules/ templates
│   │   │   ├── root/                # AGENTS.md, CLAUDE.md, README.md, README.zh-CN.md, SOURCE_OF_TRUTH.md
│   │   │   └── rules/               # 6 rule docs
│   │   ├── templates/               # 7 unit templates (主题地图, 方案单元, 案例单元, 概念单元, 观点单元, 选题装配, 问题单元)
│   │   └── tools/                   # 10 Node.js helpers (init, extract, generate, fill, rebuild, summarize)
│   ├── dbs-hook/                    # short-video opening hook optimisation
│   ├── dbs-xhs-title/               # 小红书 title formulas (736 lines)
│   ├── dbs-ai-check/                # AI-writing detection (22 patterns)
│   ├── dbs-slowisfast/              # "slow is fast" friction diagnosis
│   ├── dbs-action/                  # execution diagnosis (Adler framework, was dbs-unblock)
│   ├── dbs-deconstruct/             # Wittgenstein-style concept dissection
│   ├── dbs-goal/                    # goal clarity audit
│   ├── dbs-good-question/           # "good question" generator (471 lines)
│   ├── dbs-decision/                # personal decision system (316 lines, four-layer structure)
│   ├── dbs-save/                    # session-state save
│   ├── dbs-restore/                 # session-state restore
│   ├── dbs-report/                  # multi-session markdown report
│   ├── dbs-learning/                # interactive adaptive learning (382 lines)
│   ├── dbs-chatroom/                # directed chatroom (multi-expert)
│   ├── dbs-chatroom-austrian/       # Austrian-economics chatroom
│   ├── dbs-agent-migration/         # Agent workspace migration (357 lines, Claude/Codex/Grok)
│   └── dbs-content-system/          # (already listed above)
├── 知识库/                          # knowledge base (Chinese-named by upstream convention)
│   ├── 原子库/                      # structured atom database
│   │   ├── README.md / README.en.md / README.zh-CN.md
│   │   ├── atoms.jsonl              # full 4,176 atoms
│   │   └── atoms_{2024Q4,2025Q1,…2026Q1}.jsonl   # per-quarter splits
│   ├── Skill知识包/                 # 15 method docs
│   │   ├── diagnosis_公理与诊断框架.md / diagnosis_问题消解案例库.md
│   │   ├── benchmark_对标方法论.md / benchmark_平台运营知识.md
│   │   ├── content_内容创作方法论.md / content_平台特性与案例.md
│   │   ├── action_心理诊断框架.md / action_信号案例库.md
│   │   ├── deconstruct_语言与概念框架.md / deconstruct_解构案例库.md
│   │   ├── decision_AI协作规则.md / decision_决策记录方法论.md / decision_概念炼出方法.md
│   │   └── decision_结构与回填规则.md / decision_隐私与代号机制.md
│   └── 高频概念词典.md              # 46-term frequency glossary
├── tools/
│   └── build-skills.sh              # Bash + Python build script that emits per-skill zips
├── scripts/
│   ├── demo.tape                    # VHS demo tape for the demo.gif
│   └── record-demo.sh
├── docs/
│   ├── paid-qa-group-qrcode.png
│   ├── skill-link-map.mmd / skill-link-map.svg  # Mermaid map of skill relationships
│   ├── project-docs.manifest.json   # Axi overlay
│   └── logs/                        # build logs
└── .claude-plugin/ .github/         # plugin marketplace metadata + CI
```

## Build & Install

### Install the skill bundle (upstream)

```bash
# Claude Code plugin marketplace
claude plugin marketplace add dontbesilent2025/dbskill
claude plugin install dbs@dontbesilent-skills

# Generic (Codex / Claude Code) via the canonical installer
npx -y skills add dontbesilent2025/dbskill -g --all

# Trae Solo — one zip per skill, downloaded from GitHub Releases
# (unzip → upload each SKILL.md directory into Trae Solo's "上传技能" window)
```

### Build zips locally (upstream `tools/build-skills.sh`)

```bash
bash tools/build-skills.sh
# defaults to dist/skills/ ; reads VERSION from the repo root
# emits:
#   dbskill-${VERSION}.zip
#   {必装入口,看商业问题,做内容,进阶-内容工程,进阶-聊天室,进阶-状态管理,进阶-决策系统,进阶-Agent基建,进阶-学习,未分组}/${skill}.zip
ls dist/skills/
```

The script (Python 3 + Bash) groups skills into 10 usage buckets via the `group_for()` case statement, copies each `SKILL.md` plus its `templates/`, `scaffold/`, `docs/`, `tools/` subdirectories into a staged temp dir, follows any inline `知识库/.../*.md` references found in the SKILL.md to copy referenced knowledge files alongside, then zips each skill individually and finally zips the whole staging tree with a generated `README.md` index. The Python zip block uses `zipfile.ZipFile(..., "w", compression=zipfile.ZIP_DEFLATED)` and walks `os.walk` so the archive paths are flat relative to each skill root.

### Reference-overlay verification (Axi)

```bash
bash /Volumes/code/workspace/references/short-term/dbskill/tools/build-skills.sh
test -d /Volumes/code/workspace/references/short-term/dbskill/dist/skills
ls /Volumes/code/workspace/references/short-term/dbskill/dist/skills/   # smoke
```

For doc-only inspection, the overlay verifies:

```bash
for f in README.md README.zh-CN.md AGENTS.md VERSION docs/project-docs.manifest.json; do
  test -f "/Volumes/code/workspace/references/short-term/dbskill/$f" || exit 1
done
```

## Verification

Reference overlay verification (`VERIFICATION.md`, `docs/project-docs.manifest.json`):

- **Build verification:** `bash tools/build-skills.sh` → expect `dist/skills/` directory with the grouped zips and a top-level `dbskill-<VERSION>.zip`.
- **Smoke:** `ls dist/skills/` shows the per-group subdirectories.
- **Status (per `VERIFICATION.md`):** `documented` — reference snapshot, no Axi-owned verification required. Axi does not own the project or its release cadence; upstream is the source of truth.

`AGENTS.md` notes there is **no test suite** for this reference project; build validation is the primary check. The full content-system build also requires Node.js (for the `dbs-content-system/tools/*.js` scripts which are copied alongside the skill zip but only run when the user actually executes them inside a target project).

## Architecture Highlights

DBSkill is a **methodological kit**, not a piece of software. Its architecture is "21 SKILL.md files + a knowledge atom database + a method-doc library + one bash build script". The build is intentionally tiny because the deliverable is *content*: when the user installs the plugin, the runtime reads the SKILL.md files (and the referenced knowledge files copied alongside), the Agent interprets them as system prompts, and the user calls the skills through slash-commands (`/dbs-diagnosis`, `/dbs-decision`, `/dbs-xhs-title`, etc.).

The **`/dbs` main router** (`skills/dbs/SKILL.md`, 92 lines) is the most architecturally interesting single file in the project. Its job is intentionally narrow: "搞清楚用户需要什么，然后把他路由到正确的 skill. **你不做诊断，不做分析，不给建议。你只做路由。**". It carries a 19-row routing table (intent signals → skill name → one-line description), a 15-option clarification question for ambiguous inputs ("你现在最想解决的是什么？"), and explicit boundary rules ("用户想闲聊 → 不接。『我是诊断工具，不是聊天机器人。有具体问题就说。』"). This is a textbook example of an Agent skill that exists solely to dispatch — Axi's `/axi-...` command palette should use this exact shape when multiple skills live behind one main entry.

The **`/dbs-diagnosis` skill** (516 lines) is the largest single-purpose skill and shows how to encode a substantial methodology into a SKILL.md. It opens with **6 axioms** ("商业模式是独立于人的客观存在"; "商业模式决定人的道德"; "智力不直接变现，商业模式才变现"; "流量不等于收入"; "定价即产品"; "99% 的创业问题是心理问题"), then a mode-selection dialogue (问诊 vs 体检), then a 5-layer "消解漏斗" (语言陷阱检测 / 假设错误检测 / 逻辑错误检测 / 事实前提核查 / 信息充分性判断) — each layer has worked examples and a specific dialogue template. The skill is opinionated and deterministic about when to stop ("如果检测到语言陷阱，停下来告诉用户") and what to say next. For Axi, this is the most direct reference for how to turn a multi-stage methodology into a runnable Agent skill — axioms first, modes second, layered process third, dialogue templates fourth.

The **`/dbs-decision` skill** (316 lines) implements the four-layer decision directory pattern that is the most reusable insight for Axi. The pattern is: `01_事实/` (only-append objective facts), `02_规律/` (slow-correction concepts and patterns, original paragraph never rewritten, `[修正 YYYY-MM-DD]` appended), `03_定格/` (write-once snapshots, new version when state changes), `04_待解/` (clear-on-resolution open questions and decision events). Each layer has a `_这层放什么.md` describing what belongs there. A separate `我的当前状态.md` is the always-first-read entry point; a `SOURCE_OF_TRUTH.md` declares authority; an `AGENTS.md` enforces discipline. Five working modes are defined (初始化 / 更新当前状态 / 决策立案 / 结果回填 / 状态画像) and a strict **source-tag taxonomy** (`[本人]` / `[AI 推测]` / `[AI 结论]` / `[AI 关键标注]` / `[AI 元记录]` / `[结果回填]` / `[修正]` / `[本人 反馈]` / `[XX → 本人 / YYYY-MM]`) is enforced. Concepts must satisfy 3-of-2门槛 before promotion to `02_规律/` (出现 3 次 / 解释多事实 / 有工具性). Privacy mode forces aliases + a `.gitignore` blacklist. This is a complete template for any long-running Agent system that needs to accumulate knowledge about a user's domain.

The **`/dbs-agent-migration` skill** (357 lines) is directly applicable to Axi. It explicitly addresses the Claude/Codex/Grok three-host landscape and lays down concrete rules: classify the project as A/B/C/D by rules-layer completeness (CLAUDE.md + AGENTS.md + SOURCE_OF_TRUTH.md + skills/), classify the host landscape by which sides exist (Claude主/Codex主/Grok主/三端都有/多端都不成体系), and migrate in 4 phases (迁移审计 → 规则文件迁移 → 识别/建立 skill 真源 → 生成 bridge). The Grok-specific constraint is documented explicitly: "Grok bridge **必须** 在 frontmatter 里包含 `user_invocable: true`，否则用户在 Grok TUI 输入 `/` 后搜不到这个 skill" and "正文推荐使用 `## Grok Bridge` 小节 + 清晰的 Source of truth 绝对路径". The skill recommends using `~/.claude/skills/<name>/`, `~/.codex/skills/<name>/`, `~/.grok/skills/<name>/` as bridges pointing at a project-local `skills/` truth-source. This matches Axi's own workspace governance (`/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-009-workflow-first-bounded-agent.md` and the cross-CLI adapter contract in the workspace `AGENTS.md`).

The **`/dbs-content-system` skill** (549 lines) is a "single-directory heavy skill" — the SKILL.md declares it must be self-contained ("不要假设用户安装后还能读取仓库里的知识包、参考文档或额外支持文件"). It ships its own `scaffold/root/` (AGENTS.md, CLAUDE.md, README.md, README.zh-CN.md, SOURCE_OF_TRUTH.md), `scaffold/rules/` (6 rule docs covering field schema, dedup/version, relationships, processing flow, intake flow, source naming), `templates/` (7 unit templates: 主题地图 / 方案 / 案例 / 概念 / 观点 / 选题装配 / 问题), `tools/` (10 Node.js scripts including `init-content-system.js`, `extract-sample-units.js`, `generate-unit-draft.js`, `generate-link-map.js`, `fill-obsidian-links.js`, `assemble-topic-from-units.js`, `summarize-system.js`), and `docs/` (acceptance.md, quickstart.md). This is the most direct reference for any Axi skill that needs to *create* a structured sub-project on the user's machine.

The **knowledge-atom database** (`知识库/原子库/atoms.jsonl`, 4,176 rows) is the third reusable artefact. Each atom is a single JSONL line with `id` (`{quarter}_{seq}` like `2024Q4_001`), `knowledge` (distilled one-liner), `original` (≤200-char source), `url`, `date`, `topics` (10 categories: 商业模式与定价, 对标与模仿, 内容创作与平台, 心理与执行力, 语言与思维, 知识付费与教育, AI与工具, 中国市场与下沉, 案例与实战复盘, 人生哲学与价值观), `skills` (which skills reference it), `type` (`principle`/`method`/`case`/`anti-pattern`/`insight`/`tool`), `confidence` (`high`/`medium`/`low`). The `README.md` documents the schema, the per-quarter split is intentional (so users can subscribe to recent quarters only), and the README explicitly tells users how to consume it: paste the method docs into a system prompt for ad-hoc use, import the JSONL into a vector DB for RAG, or filter by `type`/`topics` for topic-specific retrieval. `知识库/高频概念词典.md` (46 terms, ranked by frequency) gives a vocabulary view, and the method docs in `Skill知识包/` are curated long-form papers (`diagnosis_公理与诊断框架.md` references 500 atoms; `benchmark_对标方法论.md`, `content_内容创作方法论.md`, etc.). This three-tier base (atoms / method docs / glossary) is a complete template Axi could apply to any domain corpus.

The **`tools/build-skills.sh`** script is small but worth reading for build-pipeline idioms. It uses `python3 - "$stage_dir" "$archive_path"` heredoc to do the actual zipping (Bash + Python cooperation), groups skills via a `group_for()` case statement, scans each `SKILL.md` for inline `知识库/.../*.md` references via `grep -Eo '知识库/[^\`,。 、)]*\.md'` and copies those referenced knowledge files alongside (so each skill zip is *self-sufficient* when installed). This inline-reference-following pattern is exactly what Axi needs for any "skill ships with knowledge" bundle.

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| Upstream initial release | Pin | Upstream `github.com/dontbesilent2025/dbskill` at v2.14.2 (`VERSION = 2.14.2` in checkout); per-quarter atom split `atoms_{2024Q4,2025Q1,…2026Q1}.jsonl` reflects corpus growth through 2026 Q1 |
| Axi reference overlay landing | Shipped | Overlay files `AGENTS.md`, `VERSION`, `VERIFICATION.md`, `docs/project-docs.manifest.json` in place; minimal-overlay shape for "skill collection" reference |
| 21-skill bundle shipped | Shipped (upstream) | `skills/` has 21 directories: `dbs` + 20 domain skills (counted in source dossier) |
| Knowledge-atom corpus | Shipped (upstream) | `知识库/原子库/atoms.jsonl` 4,176 rows; 10 topics; 6 types; 3 confidence levels; per-quarter splits |
| Method-doc library | Shipped (upstream) | `知识库/Skill知识包/` 15 method docs covering diagnosis / benchmark / content / action / decision |
| `#` / `#dbs-decision` four-layer directory pattern | Shipped (upstream) | `skills/dbs-decision/SKILL.md` (316 lines); `01_事实/` `02_规律/` `03_定格/` `04_待解/`; source-tag taxonomy; 5 working modes |
| `#` / `#dbs-agent-migration` cross-host (Claude/Codex/Grok) | Shipped (upstream) | `skills/dbs-agent-migration/SKILL.md` (357 lines); A/B/C/D rules-layer classification; Grok TUI `user_invocable: true` documented |
| `#` / `#dbs-content-system` heavy single-directory skill | Shipped (upstream) | `skills/dbs-content-system/SKILL.md` (549 lines) + `scaffold/root/` (5 files) + `scaffold/rules/` (6 docs) + `templates/` (7 unit templates) + `tools/` (10 Node.js scripts) + `docs/` (acceptance.md, quickstart.md) |
| Active Axi development on this checkout | Not started | Checkout is read-only reference; verification is build-only upstream |

## Authoritative Documents

- `/Volumes/code/workspace/references/short-term/dbskill/README.md` — upstream Chinese-first product overview; install instructions, the full skill list, knowledge-base schema, routing diagram, decision-system four-layer description, and update flow.
- `/Volumes/code/workspace/references/short-term/dbskill/README.zh-CN.md` — bilingual twin.
- `/Volumes/code/workspace/references/short-term/dbskill/VERSION` — current upstream version (v2.14.2 in this checkout).
- `/Volumes/code/workspace/references/short-term/dbskill/知识库/原子库/README.md` and `README.en.md` — atom-DB schema and consumption patterns.
- `/Volumes/code/workspace/references/short-term/dbskill/docs/skill-link-map.svg` — skill-relationship graph.
- Axi reference overlay: `AGENTS.md`, `VERIFICATION.md`, `docs/project-docs.manifest.json` — read in that order.

## Cross-References

- **Axi skill catalogue / command palette (`/axi-...` family)** — `skills/dbs/SKILL.md` is the cleanest "one entry, 19 sub-skills" router; the `group_for()` case statement in `tools/build-skills.sh` is the matching skill-packaging convention. Lift both for any Axi product that exposes many skills behind one entry.
- **Axi per-project long-running state (any product that accumulates user knowledge over months)** — `skills/dbs-decision/SKILL.md` (four-layer `01_事实/02_规律/03_定格/04_待解/`, source-tag taxonomy, `_这层放什么.md`, `我的当前状态.md`, `SOURCE_OF_TRUTH.md`, `AGENTS.md`) is the most directly liftable template. The privacy-mode + alias + `.gitignore` blacklist pattern is the right default for any user-private knowledge layer.
- **Axi cross-CLI governance (Claude Code / Codex / Grok)** — `skills/dbs-agent-migration/SKILL.md` encodes the exact migration flow Axi has to support (CLAUDE.md → AGENTS.md + skills/ + bridges), and explicitly documents Grok TUI's `user_invocable: true` requirement. Strong match for Axi's workspace `AGENTS.md` adapter contract (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/opencode.json`).
- **Axi knowledge-atom tooling** — `知识库/原子库/atoms.jsonl` + `README.md` is a complete pattern for turning any domain corpus (tweets, docs, call transcripts) into an Agent-ingestible JSONL database with topic taxonomy, type taxonomy, confidence scoring, and per-skill cross-reference. Lift the schema verbatim.
- **Axi "intake" skills (vague user input → structured work spec)** — `skills/dbs-good-question/SKILL.md` is a 471-line worked example of how to rewrite a vague question into an "Agent-reasoning-ready problem spec". Apply to any Axi skill that bridges user prose to structured output.
- **Axi "heavy single-directory skills"** — `skills/dbs-content-system/` (with its own `scaffold/`, `templates/`, `tools/`, `docs/`) is the template for any Axi skill that needs to *create* a structured sub-project on the user's machine and ship its own scaffolding. The `init-content-system.js` (Node.js scaffold creator) is the closest available reference for the shape of an "Axi skill bootstrap" tool.
- **Axi "diagnose only, don't fix" skills** — `skills/dbs-ai-check/SKILL.md` (22 features, no remediation) is the template for pure-diagnosis skills; the discipline of "只诊断，不改" prevents the skill from overstepping its scope.
- **Axi adaptive-learning loops** — `skills/dbs-learning/SKILL.md` (read previous feedback, generate next) and the four-mode state-management trio (`/dbs-save`, `/dbs-restore`, `/dbs-report`) together document the cross-session continuity pattern that Axi's stateful Agents need.
- **Sibling references (`sub2api`, `cockpit-tools`)** — the three dossiers together show three complementary execution models for AI tooling: sub2api is a server-side relay of AI subscriptions, cockpit-tools is a client-side credential manager for AI IDEs, and dbskill is a method-only skill bundle. The **dbs-agent-migration** skill in particular is the bridge that lets a single user move their Agent working set between these three execution models without losing state.
- **Axi documentation station (the consumer of these dossiers)** — the dossier collection itself (`/Volumes/code/workspace/.audit/dossier-collection/batch3/`) follows the same "single Markdown per project, YAML frontmatter, summary first, layout, build, verification, architecture, key modules, cross-references" shape as dbskill's README; the structural similarity is intentional and worth keeping consistent.