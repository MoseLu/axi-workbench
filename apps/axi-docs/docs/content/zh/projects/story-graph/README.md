---
id: axi-docs-zh-projects-story-graph
title: Story Graph (Pure-Silver-Earring Jianghu Series Relationship Graph Workbench)
type: project
status: published
tags: [Axi Docs, 项目, products, story-analysis, evidence-driven, react]
created: 2026-10-07
modified: 2026-10-07
graph-title: Story Graph
graph-tags: [Projects, products, story-analysis, evidence-driven]
description: Evidence-driven local novel relationship graph workbench for the 纯银耳坠江湖 series. Python pipeline + SQLite evidence layer + React/Vite viewer; default long-form view reads only confirmed-closure events; candidate relations are quarantined.
project:
  id: story-graph
  partition: products
  path: /Volumes/code/workspace/products/story-graph
  source-section: core
---

# Story Graph (Pure-Silver-Earring Jianghu Series Relationship Graph Workbench)

> 项目根 `README.md` 的镜像,深入剖析证据驱动的 pipeline、SQLite 快照与
> React/Vite viewer。权威来源:
> [`/Volumes/code/workspace/products/story-graph/README.md`](/Volumes/code/workspace/products/story-graph/README.md)。
> Section: core / Partition: `products/`。

## Summary

Story Graph 是 Axi 工作区中规范化的 `story-graph-workbench` 产品。它是一
个面向 **纯银耳坠江湖系列**(四部小说:`一起混过的日子`、`哥几个，走着`、
`我们是兄弟`、`辉煌岁月`)的、证据驱动的本地小说人物关系图工作台。产品
默认的 longform 视图只读取"证据闭环"事件;候选关系停留在审核队列,
永远不会被自动晋升。它由三层构成:Python pipeline(语料摄入、候选发
现、双模型共识、发布、审计)、SQLite 证据层(`data/evidence-store/graph.json`
的可重建查询插件)、以及带严格 loopback 绑定的 React 19 / Vite / antd 6
viewer。

项目经历了 v1 → v2 演进;v2(2026-09-14 重新验证)覆盖 6 个时代 / 82 个
事件 / 18 条弧线 / 60 个人物,Python 19/19 OK、Node 27/27 OK、TypeScript 0
错误、Vite build ~4.8s,且 Axi token check 完全一致。`_graph/` legacy
checkout 作为回滚副本保留,直到迁移被 owner 显式废弃;所有开发现在都
发生在 `app/`(React/Vite viewer)、`scripts/pipeline/`(Python)、`data/` 与
`db/`(存储)之下。

**Stage**: 线上产品(v2 完成;v3 评估待定)。
**Canonical path**: `/Volumes/code/workspace/products/story-graph`。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Viewer | React 19 + TypeScript + Vite 7 + antd 6 (`app/`) | Dev port `127.0.0.1:4173`; `strictPort: true` |
| State / routing | `zustand` (`app/stores/focus.ts`), `react-router-dom` v7 | |
| Graph rendering | `react-force-graph-2d` | |
| Loopback data server | Node.js (`app/server/evidence-store.mjs`) | Reads `db/graph.db` (preferred) or JSONL/JSON fallback; exposes REST API to viewer; data is read-only |
| SQLite | `better-sqlite3` ^11.7.0 | Built by `scripts/pipeline/migrate_sqlite.py` |
| Axi UI primitives | `@axi/core`, `@axi/crud`, `@axi/shell`, `@axi/tokens`, `@axi/widgets` (workspace `workspace:^`) | `AxiViewGroup`, `AxiCrudLayout`, `AxiSearchKey`, `AxiTable`, `AxiTag`, `AxiSidebar`, `AxiTopbar`, etc. |
| Local Axi components | `app/components/shared/{ThemeToggle,AxiSwitchButton,AxiEventCard,AxiThemeArc}.tsx` + `.scss` | Mandatory barrel registration via `app/components/shared/index.ts` + `AXI_COMPONENTS_REGISTERED` tuple + `app/styles/_axi-components.scss` |
| Styling | SCSS (legacy bridge) + Tailwind 3 + antd 6 tokens | `app/theme.ts` owns the resolved antd mode palette |
| Python pipeline | `scripts/pipeline/evidence_pipeline.py` + `run_unattended.py` + `minimax_review.py` + `migrate_sqlite.py` + `backfill_event_features.py` | Stdlib-only; uses `urllib.request`; structured via dataclasses |
| Data inputs | 4 raw `.txt` files at repo root | Identifiers: `hun_guo`, `zou_zhe`, `xiong_di`, `hui_huang` |
| Evidence store | `data/evidence-store/` (read-only fact boundary) | `graph.json` (formal graph), `candidates.jsonl`, `review_queue.jsonl`, `discovered_entities.jsonl`, `consensus_decisions.jsonl`, `minimax_decisions.jsonl`, `local_decisions.jsonl`, `event-details.json`, `golden_sample.jsonl`, `quality_report.json` |
| Token scripts | `app/scripts/build-tokens.mjs`, `app/scripts/check-token-consistency.mjs` | Plus inherited `foundation/axi-ui/scripts/check-design-tokens.mjs`, `check-ui-aesthetic.mjs` |
| Test surface | `python3 -m unittest` (10+ tests in `tests/`); `node --test app/server/*.test.mjs` (27 tests); Vitest for components | |

## Project Layout

```text
products/story-graph/
├── app/                              ★ React/Vite viewer
│   ├── main.tsx, layout.tsx, ThemeProvider.tsx, theme.ts, palette.ts
│   ├── index.html, vite.config.ts, vitest.config.ts, tsconfig.json
│   ├── package.json, pnpm-lock.yaml, package-lock.json
│   ├── routes/
│   │   ├── graph/GraphExplorer.tsx, graphUrl.ts
│   │   ├── longform/LongStoryView.tsx, MasterList.tsx, PeoplePopover.tsx, StoryDetailDrawer.tsx
│   │   ├── chain/                    # complete chain view
│   │   ├── scope/                    # scoped view
│   │   └── timeline/                 # timeline view
│   ├── components/shared/            # local Axi components + MANIFEST.md + index.ts barrel
│   │   ├── ThemeToggle.tsx/.scss + .test.tsx
│   │   ├── AxiSwitchButton.tsx/.scss
│   │   ├── AxiEventCard.tsx/.scss
│   │   ├── MANIFEST.md (single source of truth for reusable UI primitives)
│   │   └── index.ts (barrel + AXI_COMPONENTS_REGISTERED tuple)
│   ├── lib/        (formal-graph.ts, graph-layout.ts, url-state.ts, viewer-format.ts)
│   ├── stores/     (focus.ts)
│   ├── client/     (timeline.ts — typed by app/client)
│   ├── types/
│   ├── config/
│   ├── styles/     (main.scss, _axi-components.scss, _legacy-theme.scss, _longform.scss, _graph.scss)
│   ├── server/     (evidence-store.mjs + .d.mts + .test.mjs + formal-graph.test.mjs)
│   ├── tokens/     (admin.json + light blocks)
│   ├── scripts/    (build-tokens.mjs, check-token-consistency.mjs)
│   ├── tailwind.config.ts, postcss.config.ts
│   └── test/, public/, hyperframes/
├── scripts/pipeline/                 ★ Python pipeline
│   ├── evidence_pipeline.py          # ingest / discover / candidates / consensus / publish / audit
│   ├── run_unattended.py
│   ├── minimax_review.py             # cloud model review
│   ├── migrate_sqlite.py
│   ├── backfill_event_features.py
│   └── README.md
├── data/
│   ├── corpus/                       # corpus.py, split_chunks.py, names.json, chunks/
│   ├── evidence-store/               # ★ published formal evidence (PRD P0: do not modify)
│   │   ├── graph.json                # 15-edge formal graph (confidence ≥ 0.85, double-model consensus)
│   │   ├── candidates.jsonl          # 608 candidate relations (review queue)
│   │   ├── review_queue.jsonl, discovered_entities.jsonl
│   │   ├── consensus_decisions.jsonl, minimax_decisions.jsonl, local_decisions.jsonl
│   │   ├── entity_registry.json, catalog.json, event-details.json
│   │   ├── quality_report.json, runs/, minimax_runs/, golden_sample.jsonl
│   │   ├── graph.html
│   │   └── event-detail-patches/
│   ├── relations/series.json         # published relations
│   ├── timeline/                     # narrative-evidence.json, world-context.json, story-threads.json, people.json, series-events.json, build-timeline.mjs
│   └── wangyue/                      # 王越专题
├── db/                               # SQLite snapshot
│   └── graph.db                      # rebuildable; preferred over JSONL for snapshot reads
├── tests/                            # Python tests
│   ├── test_evidence_pipeline.py     # 10 tests
│   └── test_event_features.py        # 9 tests
├── _graph/                           # ⚠️ legacy compatibility shell (rollback copy until retired)
│   ├── Makefile, migrate.sh          # forward to scripts/pipeline and app/
│   ├── viewer/{package.json, README.md}
│   └── README.md
├── 一起混过的日子.txt / 哥几个，走着.txt / 我们是兄弟.txt / 辉煌岁月.txt
├── PRD.md, DESIGN.md, TASK.md, CHANGE.md, MILESTONE.md, AGENTS.md, README.md, README.zh-CN.md, TDD.md
├── PRD_MINIMAX_人物关系图谱完善.md, PRD_时间线叙事人物关系图谱.md
├── docs/, scripts/, data/, pnpm-workspace.yaml, pnpm-lock.yaml
```

不要将 `app/` 拆分到独立仓库;viewer 通过 `app/server/evidence-store.mjs`
直接读取 evidence store,因此 Vite dev server 与 SQLite snapshot 之间的
接缝保持在本地。

## Build

```bash
cd /Volumes/code/workspace/products/story-graph

# Frontend
pnpm --dir app install
pnpm --dir app run dev          # http://127.0.0.1:4173
pnpm --dir app run build        # ~4.8s

# Rebuild SQLite cache from canonical JSON evidence
python3 scripts/pipeline/migrate_sqlite.py
# or via legacy compat shell
bash _graph/migrate.sh reset
```

## Verification

```bash
# Python pipeline
python3 -m unittest -q tests/test_evidence_pipeline.py      # 10/10
python3 -m unittest -q tests/test_event_features.py         # 9/9

# Node evidence-store
node --test app/server/evidence-store.test.mjs              # 27/27
node --test app/server/formal-graph.test.mjs

# Viewer
pnpm --dir app run build                                     # ~4.8s
pnpm --dir app run typecheck                                 # 0 errors

# Token consistency
pnpm --dir app run tokens:check
pnpm --dir app run tokens:consistency

# Design / aesthetic gates (inherited from foundation/axi-ui)
pnpm --dir app run check:design-tokens
pnpm --dir app run check:ui-aesthetic --strict

# Workspace governance
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate
```

Health: `test -f db/graph.db`。

## Architecture Highlights

证据驱动的 pipeline 是本项目的心脏。`scripts/pipeline/evidence_pipeline.py`
是一个仅依赖标准库的 Python pipeline,负责:摄入四份 `.txt` 小说、切分
chunks、通过严格的触发词分类法(`亲属 / 恋爱 / 朋友/结拜 / 敌对 /
上下级 / 师承 / 组织归属 / 合作 / 事件参与者`)提出候选实体/关系三元组,
并将其送入 **双模型共识**(本地 LLM judge + 云端 MiniMax 评审 in
`minimax_review.py`)流程。两个独立决策必须一致,每个决策都必须引用至少
两处可定位的源引文,且 confidence ≥ 0.85 才允许进入 `graph.json`。当前
`graph.json` 恰好包含 15 条已发布边;`candidates.jsonl` 持有 608 条待审。
人物 ID 明确按 `book_id:person:规范名` 命名空间,**绝不跨书自动合并**
—— 同名于两部小说的角色视为两个不同节点。

SQLite 层是 **可重建的查询插件**,而不是真理之源。
`scripts/pipeline/migrate_sqlite.py` 读取 `data/evidence-store/graph.json`
并重建 `db/graph.db`。`app/server/evidence-store.mjs` 中的 loopback 数据
服务在 SQLite 比对应的源 JSON/JSONL 文件新时优先选 SQLite,否则回退到
JSON —— mtime 策略与 `SIZE_GUARD_THRESHOLDS`(scenes 500k、
relation_candidates 50k、discovered_entities 50k、chapters 50k)被显式
规定,目的是当快照开始变慢时,团队在用户察觉前就重提"单一 readonly SQLite"
决策。`evidence-store.mjs` 数据层在合同上是只读的;候选数据绝不用于推导
正式边;size guard 计数反馈到审计面板。同一模块还按 mtime/sqlite_mtime
缓存读取,避免重复解析同一过滤请求。

React/Vite viewer(`app/`)将职责拆分为 5 个 routes(`graph`、`longform`、
`chain`、`scope`、`timeline`),加上 longform 共享的 `AxiViewGroup` 双面板
布局。本地 Axi 组件 barrel(`app/components/shared/index.ts` +
`AXI_COMPONENTS_REGISTERED` 元组 + `app/styles/_axi-components.scss`)被强
制:`ThemeToggle`、`AxiSwitchButton`、`AxiEventCard`、`AxiThemeArc` 是目
前注册的 4 个本地组件;上游原语(`@axi/shell` 的 `AxiSidebar`、`AxiTopbar`、
`AxiViewGroup`;`@axi/crud` 的 `AxiCrudLayout`、`AxiSearchKey`、`AxiTable`;
`@axi/core` 的 `AxiTag`、`AxiPage`、`AxiIconButton`)直接从对应 workspace
包导入,并通过 `app/package.json` 的 `workspace:^` 引用消费。页面不得直接
import 组件文件 —— barrel-and-MANIFEST 规则的设立,就是为了阻止重新发明
原语。

叙事阅读层 v2(`DESIGN.md`,2026-08-05)以 **主线地图 + 五段式事件账本**
取代了旧的"事件计数 + dashboard chrome"longform。默认 `/story/longform`
路由打开一个左侧 aside(`MasterList`,覆盖 全部 / 一代 / 二代 / 三代)与
一个由三代叙事脊柱 + 五段式事件账本组成的右侧主体。graph explorer 按故事
阶段(王越 → 王龙 → 王力)从左到右阅读,作为突出的一/二/三代延续点;每张
事件卡恰好呈现三个 facet —— `发生时间`(时代 + 稳定序号)、`事件主人公`
(金边主角 chips + 配角人物 pills)。没有任何 view 渲染 `Statistic` /
dashboard 计数器。`wy-school-starts` 的兄弟叙事上下文完全位于
`data/timeline/people.json` + 事件 summary 之中,**不会**引入任何新的正式
`graph.json` 边。

Token 一致性是 build pipeline 的一部分。`app/scripts/build-tokens.mjs`
生成 `tokens/{admin.json, light blocks}`;`check-token-consistency.mjs` 断言
`main.css / variables.css / light blocks` 与 `admin.json` 一致;
`foundation/axi-ui/scripts/check-design-tokens.mjs` 与
`check-ui-aesthetic.mjs --strict` 被接入 `pnpm --dir app check:*`,使标准
成为"上游 Axi 原语与本地覆盖之间的 design tokens 与美学规范必须保持
一致"。

## Key Modules/Files

| Path | Role |
| --- | --- |
| `/Volumes/code/workspace/products/story-graph/AGENTS.md` | Read order, package manager rule (`pnpm --dir app`), Axi UI barrel discipline (mandatory for every page author), currently registered components mirror |
| `/Volumes/code/workspace/products/story-graph/README.md` | Primary entrypoint; layout ASCII tree; pipeline runbook; safety constraints (formal edges only from `graph.json`, loopback-only) |
| `/Volumes/code/workspace/products/story-graph/PRD.md` | L2 PRD; 7 functional requirements (FR-1..FR-7); 7 acceptance criteria; provides `story-graph-workbench`, `novel-relationship-graph`, `evidence-driven-story-analysis`; consumes none |
| `/Volumes/code/workspace/products/story-graph/DESIGN.md` | Narrative-reading v2 design rationale; brand/personas/IA/components/accessibility/responsive/interaction/content voice/implementation constraints |
| `/Volumes/code/workspace/products/story-graph/docs/HANDOFF.md` | Zero-context takeover; 90-second read order; troubleshooting (incl. `pnpm approve-builds` for better-sqlite3 native binding) |
| `/Volumes/code/workspace/products/story-graph/app/package.json` | Viewer deps (`antd` ^6.5.3, `react` ^19.1.1, `react-router-dom` ^7.9.4, `zustand` ^5.0.14, `react-force-graph-2d` ^1.29.0, `better-sqlite3` ^11.7.0, `@axi/*` `workspace:^`); scripts `tokens`, `tokens:check`, `tokens:consistency`, `check:design-tokens`, `check:ui-aesthetic` |
| `/Volumes/code/workspace/products/story-graph/app/components/shared/MANIFEST.md` | Single source of truth for reusable in-app UI primitives; lists `ThemeToggle`, `AxiSwitchButton`, `AxiEventCard`, `AxiThemeArc`; documents the upstream `@axi/*` consumption rule |
| `/Volumes/code/workspace/products/story-graph/app/components/shared/index.ts` | Runtime + types barrel; `AXI_COMPONENTS_REGISTERED` tuple (must stay in sync with MANIFEST.md) |
| `/Volumes/code/workspace/products/story-graph/app/server/evidence-store.mjs` | Loopback data server; `RELATION_TYPES` whitelist, `SIZE_GUARD_THRESHOLDS`, mtime-based SQLite vs JSONL preference, sync HTTP-facing helpers (cache by mtime/sqlite_mtime); pairs with `formal-graph.test.mjs` and `evidence-store.test.mjs` |
| `/Volumes/code/workspace/products/story-graph/scripts/pipeline/evidence_pipeline.py` | Main pipeline: `BOOKS`, `RELATION_TYPES`, `RELATION_STATUS`, `DECISIONS`, `TRIGGERS` taxonomies; pipeline subcommands (ingest / discover / candidates / consensus / publish / audit); LLM checkpoints by candidate_id for resumability |
| `/Volumes/code/workspace/products/story-graph/scripts/pipeline/minimax_review.py` | Cloud MiniMax model reviewer for double-model consensus |
| `/Volumes/code/workspace/products/story-graph/scripts/pipeline/migrate_sqlite.py` | JSON/JSONL → SQLite snapshot builder |
| `/Volumes/code/workspace/products/story-graph/data/evidence-store/graph.json` | Published formal graph (`schema_version: 2`, `confidence_threshold: 0.85`, `publication_mode: double_model_consensus`); 15 edges, person IDs namespaced as `book_id:person:规范名` |
| `/Volumes/code/workspace/products/story-graph/data/evidence-store/candidates.jsonl` | 608 candidate relations awaiting review (never auto-promoted) |
| `/Volumes/code/workspace/products/story-graph/data/evidence-store/review_queue.jsonl`, `discovered_entities.jsonl`, `consensus_decisions.jsonl`, `minimax_decisions.jsonl`, `local_decisions.jsonl` | Pipeline checkpoints and decision trail |
| `/Volumes/code/workspace/products/story-graph/data/timeline/people.json`, `series-events.json`, `narrative-evidence.json`, `world-context.json`, `story-threads.json`, `build-timeline.mjs` | Narrative source of truth (separate from formal graph); `narrative-evidence.json` `confirmed` records are the only ones that reach the reader interface |
| `/Volumes/code/workspace/products/story-graph/app/routes/longform/LongStoryView.tsx` | Default `/story/longform`; left aside = `MasterList`, right main = three-gen spine + five-segment ledger; uses upstream `AxiViewGroup` + `AxiCrudLayout` + `AxiSearchKey` + `AxiTable` |
| `/Volumes/code/workspace/products/story-graph/app/routes/graph/GraphExplorer.tsx` | Brand-only topbar; current featured event card; six narrative phase nodes; generation spine; secondary relationship-arc layer; no statistic counters |
| `/Volumes/code/workspace/products/story-graph/_graph/README.md` | Legacy compatibility shell documentation; `_graph/viewer/{package.json, README.md}` is the compatibility shell for `_graph/viewer/` script forwarding |
| `/Volumes/code/workspace/products/story-graph/.github/workflows/ci.yml` | GitHub Actions CI gate (added 2026-09-24; current `feature/ci-check-design-tokens-entry` branch adds `check:design-tokens` / `check:ui-aesthetic` entries) |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Multi-gen graph v1 | Initial 4-novel coverage with double-model consensus | Done |
| Multi-gen graph v2 | Re-verified 6 eras / 82 events / 18 arcs / 60 people; narrative-reading v2 (主线程地图 + 五段式账本) | Done (re-verified 2026-09-14) |
| Workspace scaffolding | `TODO.md`, `docs/state/TODO.md`, `docs/state/MILESTONE.md`; `manifest` with `docs_entrypoints` / `documents`; `.github/workflows/ci.yml` | Done (2026-09-19, 2026-09-24) |
| Multi-gen graph v3 | Timeline build-timeline generator upgrade; tighten `tailwind.config.ts` `content` glob; rollback checkout formal retire | Pending (owner decision required) |

实时 milestone 文档见 `docs/state/MILESTONE.md`。

## 备注

- PRD P0 安全约束 —— 「正式边只能来自 `graph.json`」、「候选关系永不自动
  晋升」、「只走 loopback 绑定」、「`data/evidence-store/` 是事实边界」——
  不可协商;未达到两个独立决策 + ≥ 0.85 confidence 即晋升候选,正是本项目
  要防止的典型失败模式。
- `_graph/` legacy 兼容 shell 为本项目独有,是 v3 评估中唯一可正式废弃的
  候选。
- 通过 `@axi/*` `workspace:^` 消费的 Axi UI 原语来自
  `foundation/axi-ui/` —— 上游 Axi UI monorepo。
- 本项目是唯一带 `app/server/evidence-store.mjs` 数据层的产品;未经 owner
  明确批准,不得将其作为可复制到其他产品的模式。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/products/story-graph/AGENTS.md) — package manager rule, Axi UI component discipline, currently registered components
- [`README.md`](/Volumes/code/workspace/products/story-graph/README.md) — primary entrypoint
- [`README.zh-CN.md`](/Volumes/code/workspace/products/story-graph/README.zh-CN.md) — Simplified Chinese mirror
- [`PRD.md`](/Volumes/code/workspace/products/story-graph/PRD.md) — L2 PRD (FR-1..FR-7, AC-1..AC-7); provides `story-graph-workbench`, `novel-relationship-graph`, `evidence-driven-story-analysis`
- [`DESIGN.md`](/Volumes/code/workspace/products/story-graph/DESIGN.md) — narrative-reading v2 + visual/responsive/accessibility/interaction/content-voice rules
- [`TASK.md`](/Volumes/code/workspace/products/story-graph/TASK.md) — active tasks
- [`TDD.md`](/Volumes/code/workspace/products/story-graph/TDD.md) — test-driven design
- [`CHANGE.md`](/Volumes/code/workspace/products/story-graph/CHANGE.md) — change log (long-form)
- [`MILESTONE.md`](/Volumes/code/workspace/products/story-graph/MILESTONE.md) — milestone status snapshot
- [`docs/HANDOFF.md`](/Volumes/code/workspace/products/story-graph/docs/HANDOFF.md) — zero-context handoff (90-second read order, troubleshooting)
- [`app/package.json`](/Volumes/code/workspace/products/story-graph/app/package.json) — viewer manifest + `@axi/*` workspace references
- [`app/components/shared/MANIFEST.md`](/Volumes/code/workspace/products/story-graph/app/components/shared/MANIFEST.md) — UI component registry
- [`app/server/evidence-store.mjs`](/Volumes/code/workspace/products/story-graph/app/server/evidence-store.mjs) — loopback data access contract
- [`scripts/pipeline/evidence_pipeline.py`](/Volumes/code/workspace/products/story-graph/scripts/pipeline/evidence_pipeline.py) — Python pipeline
- [`data/evidence-store/graph.json`](/Volumes/code/workspace/products/story-graph/data/evidence-store/graph.json) — published formal graph (read-only fact boundary)
- [`db/graph.db`](/Volumes/code/workspace/products/story-graph/db/graph.db) — SQLite query artifact (rebuildable)
- [`scripts/pipeline/README.md`](/Volumes/code/workspace/products/story-graph/scripts/pipeline/README.md) — pipeline usage
- [`_graph/README.md`](/Volumes/code/workspace/products/story-graph/_graph/README.md) — legacy compatibility shell documentation

## Cross-References

- Workspace graph: [`/Volumes/code/workspace/workspace.graph.json`](/Volumes/code/workspace/workspace.graph.json) — `story-graph` provides `story-graph-workbench`, `novel-relationship-graph`, `evidence-driven-story-analysis`; consumes none.
- 通过 `@axi/*` `workspace:^` 消费的 Axi UI 原语来自 [`/Volumes/code/workspace/foundation/axi-ui/`](/Volumes/code/workspace/foundation/axi-ui/) —— 上游 Axi UI monorepo。`AGENTS.md` 的跨 workspace 注释明确警告:早期文档中引用的 `axi-workbench/packages/ui` 或 `foundation/axi-ui/packages/shell/src/` 可能只是示例起点。
- 本项目是唯一带 `app/server/evidence-store.mjs` 数据层的产品;未经 owner 明确批准,不得将其作为可复制到其他产品的模式。
- `_graph/` legacy 兼容 shell 为本项目独有,是 v3 评估中唯一可正式废弃的候选。