---
id: axi-docs-en-projects-story-graph
title: Story Graph
type: project
status: draft
tags: [Axi Docs, Projects, products, reference]
created: 2026-08-07
modified: 2026-08-07
graph-title: Story Graph
graph-tags: [Projects, products]
description: Evidence-driven local novel relationship graph workbench with a Python pipeline, SQLite evidence store, and React/Vite viewer.
project:
  id: story-graph
  partition: products
  path: /Volumes/code/workspace/products/story-graph
  source-section: reference
---

# Change Log

> Per AR-CHANGE-001 (axi-rules § Change Protocol), entries are appended
> newest-first under `## Unreleased`. Each `Re-verified at:` line re-affirms
> the evidence cited in `docs/HANDOFF.md` and
> `docs/project-docs.manifest.json` after the seven-day stale window
> (AR-HANDOFF-003).

## Unreleased

### 2026-08-05 — fix(test): 修复 formal-graph.test.mjs 迁移遗留的失效导入

- **症状**：`node --test app/server/formal-graph.test.mjs` 以
  `ERR_MODULE_NOT_FOUND` 整体失败（0 pass / 1 fail），找不到
  `app/src/lib/formal-graph.ts`。
- **根因**：`41c4a80`（Next.js 风格目录迁移）把
  `_graph/viewer/src/lib/formal-graph.ts` → `app/lib/formal-graph.ts`、
  `_graph/viewer/server/formal-graph.test.mjs` → `app/server/formal-graph.test.mjs`，
  两个文件都是纯 rename（diff 显示 0 行改动），但测试里的相对导入
  `../src/lib/formal-graph.ts` 在旧布局下成立、在新布局下失效——
  lib 迁移后与 server 同级，正确路径是 `../lib/formal-graph.ts`。
  `app/src/` 目录现已不存在。
- **修复**：改这一行导入路径。全仓扫描确认无其他 `../src/` 残留导入。
- **结果**：该文件 2/2 通过；Node 测试恢复全绿
  （evidence-store 25、formal-graph 2、build-timeline 17）。

### 2026-08-05 — chore: 从项目完全剔除《像六哥一样活着》(liu_ge)

- **动机**：`liu_ge` 是独立世界作品，与"纯银耳坠"主系列无叙事交集，
  从未进入时间线、正式图谱或候选关系（`graph_nodes` / `graph_edges` /
  `relation_candidates` / `timeline_events` 中 `liu_ge` 计数一律为 0），
  只在语料层留下 705 章 / 1657 场景的死数据。现整本剔除。
- **语料**：删除项目根 `像六哥一样活着.txt`（5.4 MB，未入 Git，`/*.txt` 已忽略）。
- **流水线脚本**：`scripts/pipeline/evidence_pipeline.py` 移除 `BOOKS` 中的
  `liu_ge` 条目；`scripts/pipeline/migrate_sqlite.py` 从 `BOOK_IDS` /
  `BOOK_FILE_TO_ID` / `BOOK_CN_TO_SLUG` 移除；
  `scripts/pipeline/backfill_event_features.py` 移除 `BOOK_CN_TO_SLUG` 条目
  与 `era_id == 'liu_ge_standalone' -> 'liu_ge'` 两处死分支（该 era 从未
  在 `timeline_eras` 中存在，六个正式 era 为 youth/inhouse/betrayal/
  elder/raise/afterglow）。
- **SQLite (`db/graph.db`)**：删除 `books` 1 行、`chapters` 705 行、
  `scenes` 1657 行、`discovered_entities` 243 行、
  `discovered_entity_scenes` 661 行、`locations` 7 行、
  `wangyue_book_summary` 1 行（该行 title/hero 本就为空）。
  全表逐列扫描确认无 `liu_ge` 残留。
- **证据存储**：`data/evidence-store/` 与 `_graph/evidence_store/` 两份
  `chapters.jsonl` / `scenes.jsonl` / `discovered_entities.jsonl` 按
  `book_id == 'liu_ge'` 逐行剔除；两份 `catalog.json` 的 `books` 6 → 5
  （余下 4 本正文 + 1 条 `re_xue_download_page` excluded 记录）。
- **同名消歧**：`timeline_people.summary`（DB）与
  `data/timeline/people.json` / `timeline-view.json`、
  `_graph/timeline/` 同名两份中 `person:bao-ge` 的消歧句
  去掉"《像六哥一样活着》的李纪宝"分支，保留与《兄弟》王中宝的消歧。
- **文档**：`PRD.md`（Scope 5 本 → 4 本、删除已知限制表中的独立世界条目）、
  `README.md` 目录树、`TDD.md`（`books.id` 注释与后续演进表）、
  `app/README.md` / `_graph/viewer/README.md` 已知限制重新编号。
- **保留**：`data/evidence-store/scenes.jsonl` 与
  `data/corpus/chunks/兄弟_07.txt` 中命中的"六哥一样活着"是
  《我们是兄弟》正文里的口语措辞，非书目引用，不做改动。

### 2026-08-05 — docs: PRD v3 + rule-compliant doc scaffolding (story-graph docs)

- **PRD v3 整合**：把"故事长卷 v2"的阅读层契约、`narrative-evidence.json`
  / `world-context.json` / `story-threads.json` 三件套、11 个 `/api/...` 端点、
  五视图路由、共享组件三层注册规约、P0 约束 1–15、发布准则与已知限制
  写齐为单一最新 PRD 文档（替换 v2 的临时增量说明）。
  Re-verified at: 2026-08-05.
- **docs/HANDOFF.md**：按 AR-HANDOFF-001 90 秒读序与 AR-HANDOFF-004
  9 步零上下文接管流程重写；新增 "Self-published contract impact"
  段（AR-HANDOFF-005）与 `currentWork` 关键字段。
  Re-verified at: 2026-08-05.
- **TODO.md / docs/state/TODO.md / docs/state/MILESTONE.md**：补齐
  AR-LIFECYCLE-001/003 要求的"当前任务 + 完成 / 剩余 / 下一步"门面文件。
- **docs/project-docs.manifest.json**：保留 v2 顶层；为符合
  AR-HANDOFF-002，新增 `docs_entrypoints` 中的 `TODO.md` 与
  `docs/state/*` 入口，并在 `documents` 中显式列出。
- **本文档**：补 `## Unreleased` 锚点（AR-CHANGE-001）；最新证据附
  `Re-verified at: <date>`（AR-HANDOFF-003）。

## 2026-08-05 (多代叙事图谱 / 故事长卷 v2)

把“故事长卷”从统计式事件表改为可追溯的叙事阅读入口，同时保持
正式证据库与关系图的事实边界不被阅读摘要反向污染。

- 新增 narrative-evidence.json、world-context.json、story-threads.json：
  三代主线、两条感情线、引荐/势力与城市伏笔均以
  “起点 → 压力 → 选择 → 后果”组织；未闭环的天地会、李封家系、
  刘震东—唐焱—宋洋等信息保留在审核队列。
- timeline-view.json 升级为 v2，保留既有 eras/events/arcs/people
  兼容字段，并增加仅含证据闭环内容的 reader 子集、世界上下文和
  主线数据。生成器现在拒绝未知引用、别名冲突、重复关系弧和不完整的
  主线四段。
- 长卷继续使用 AxiViewGroup 双栏骨架：左侧为无数量徽标的叙事导航；
  右侧为三代叙事脊柱与五段式事件账本。人物、组织、地点和主线均可通过
  深链档案往返，原有 event/person/arc 参数保持兼容，并新增
  org/place/thread/lens。
- 1280px 以下账本自动转为 Axi 表格承载的语义卡片，避免横向溢出；
  960px 以下叙事导航默认收起但仍可由 AxiViewGroup 控件打开。

验证：时间线构建与 15 项生成器测试、25 项证据服务测试、Python
证据/事件测试（10 + 9）、TypeScript 无输出检查、Axi token 检查及
前端生产构建均通过。浏览器已实测 1280 / 960 / 768px、搜索、键盘进入
档案及事件—人物/组织/地点往返。

## 2026-08-05 (narrative continuity / evidence anchors)

Second exploration pass repairs the story scroll's cross-book handoff points
and keeps each new conclusion traceable to a chapter/scene anchor.

- Split the 博海涛改姓弃婴、汪威带离、刘震东寻回抚养 chain instead of
  attributing every identity change to 刘震东.
- Corrected 王慈's blindness event to the verified car-impact scene and
  removed the unsupported 李磊刺杀后自残 summary.
- Added the school-to-university brother dispersal, 曲剑玉佩, 沈风救援,
  黑虎引路网络, and 王力—宝哥失势/救援 bridge events.
- Removed the unsupported 王力=博雨傲 / 王力—王慈 sibling assertions from
  the curated series relations; the remaining 王力—王越 link is only
  前辈提携.
- Rebuilt `data/timeline/timeline-view.json` at 6 eras / 71 events / 18 arcs /
  50 people.

Verification: timeline tests 7/7, evidence-store tests 22/22, Python evidence
pipeline 10/10, and `npm --prefix app run build` passed.

## 2026-08-05 (graph / chain page component split)

P0 split (recorded in the previous changelog entry) brought the two
largest story pages under the 500-line threshold. This batch finishes
the audit's P1 work — the remaining two >500-line page files become
single-purpose imports.

- **`fbb30ba refactor(graph): extract layout helpers to lib + URL helpers to sibling`**

  GraphExplorer.tsx was 640 lines. The growth was 14 layout / pathing /
  sort helpers (line 86-292) plus the four GraphTree interfaces plus
  the URL_SPEC / syncGraphUrl pair (line 37-40 / 294-301). None of
  these touch React state — they belong in a lib, not a route
  component.

  - `app/lib/graph-layout.ts` (new, 342): owns every pure helper +
    the layout / pathing interfaces. The single non-pure concern is
    the 'presentation parameters' (canvas dimensions, phase list,
    root person id, primary person meta), which the helper accepts
    via a `GraphLayoutOptions` object so it stays React-free and
    unit-testable. Sits next to `app/lib/url-state.ts` and
    `app/lib/palette.ts` as another pure-functions leaf of lib/.
  - `app/routes/graph/graphUrl.ts` (new, 26): owns the `GRAPH_URL_SPEC`
    + `syncGraphUrl` pair. Page-local (only Graph uses this URL
    schema) so it lives next to GraphExplorer.tsx, mirroring the
    StoryDetailDrawer.tsx sibling pattern.
  - `app/routes/graph/GraphExplorer.tsx` (640 -> 395): drops the
    interfaces + helpers + URL_SPEC + syncGraphUrl in favour of named
    imports from the two new files, and assembles the
    GraphLayoutOptions object inline at the layoutTree call site.

- **`597b1ef refactor(chain): extract list/column components to sibling file`**

  ChainLayerView.tsx was 599 lines. Five page-local presentation
  components (`EventListItem` / `ArcListItem` / `PersonListItem` /
  `ChainColumn<T>` / `TopLongScroll`) accounted for line 27-196, mixed
  in with React state, data fetch, focus wiring and Tabs rendering.

  - `app/routes/chain/components.tsx` (new, 186): owns the five
    display components plus the `PeopleLookup` interface that chains
    them together.
  - `app/routes/chain/ChainLayerView.tsx` (599 -> 432): drops the
    five component function bodies, the `PeopleLookup` interface, and
    the now-unused antd `Tabs` import; the main route file is left
    with state, data fetching, filter / focus wiring, and the JSX
    wiring that composes those five components.

Result line counts after both P0 + P1 batches:

| File | Original | After P0 | After P1 |
|---|---|---|---|
| LongStoryView.tsx | 619 | 478 | 478 |
| TimelineView.tsx | 570 | 393 | 393 |
| GraphExplorer.tsx | 640 | — | 395 |
| ChainLayerView.tsx | 599 | — | 432 |

The audit's success criterion — every front-end file under 500 lines —
is now met for every page-level route. `app/server/evidence-store.mjs`
(1103) is the only remaining over-threshold source file, and that is
the stable API boundary documented in the previous changelog entries;
no action item.

All new sibling / lib files are explicitly NOT registered in
`components/shared/` or listed in `MANIFEST.md` — they are
page-local presentation / pure-function helpers, not reusable UI
primitives.

Verification:

- `node --test app/server/evidence-store.test.mjs` → 22 tests, 21 pass + 1 pre-existing failure (unchanged)
- `npm run tokens:consistency` → 6/6 ✓
- `npm run build` → ok (~2.7s)
- `python3 -m unittest -q tests/test_evidence_pipeline.py` → 10/10
- `python3 -m unittest -q tests/test_event_features.py` → 9/9

## 2026-08-05 (longform / timeline page component split)

Audit found `LongStoryView.tsx` (619) and `TimelineView.tsx` (570)
both above the 500-line threshold, with growth driven by page-local
subcomponents rather than real reusable UI. Move each subcomponent
into a sibling file next to its page, mirroring the existing
`StoryDetailDrawer.tsx` style. The new files are explicitly NOT
registered in `components/shared/` and NOT listed in MANIFEST, since
they are page-local.

Four atomic commits, in dependency order (helpers / types travel
with their components):

| # | Commit | What moved |
|---|---|---|
| 1 | `8ff7bf7 refactor(longform): extract PeoplePopover to sibling component` | PeoplePopover + GENERATION_LABEL / GENERATION_COLOR / personGeneration |
| 2 | `c8523bf refactor(longform): extract MasterList to sibling component` | MasterList + GenerationSpec + GENERATION_ORDER / GENERATION_META / ALL_SENTINEL; inline visibleCount at its single call site |
| 3 | `9c9a086 refactor(timeline): extract StageFilterPanel to sibling component` | StageFilterPanel + TimelineStageSummary + EraFilter; drops Menu / AppstoreOutlined / BookOutlined from main page |
| 4 | `5062932 refactor(timeline): extract TimelineEventTable to sibling component` | TimelineEventTable + personInitials + PeopleLookup + TIMELINE_PAGE_SIZE; drops Avatar / Tooltip / Button / Table / TableColumnsType from main page; re-exports DetailTargetValue so both files share one type definition |

Result line counts:

| File | Before | After | Delta |
|---|---|---|---|
| `LongStoryView.tsx` | 619 | 478 | -141 |
| `TimelineView.tsx` | 570 | 393 | -177 |

New sibling files:

- `app/routes/longform/PeoplePopover.tsx` (134)
- `app/routes/longform/MasterList.tsx` (107)
- `app/routes/timeline/StageFilterPanel.tsx` (58)
- `app/routes/timeline/TimelineEventTable.tsx` (168)

Verification:

- `node --test app/server/evidence-store.test.mjs` → 22 tests, 21 pass + 1 pre-existing failure (unchanged from prior batch)
- `npm run tokens:consistency` → 6/6 ✓
- `npm run build` → ok (~2.8s)
- `python3 -m unittest -q tests/test_evidence_pipeline.py` → 10/10
- `python3 -m unittest -q tests/test_event_features.py` → 9/9

Out of scope (recorded for next session, but not changed in this batch):

- `GraphExplorer.tsx` (640) / `ChainLayerView.tsx` (599) — still above threshold; left to a future split pass
- `readDetailTarget` / `writeDetailUrl` duplication between `LongStoryView` and `TimelineView` — separate dedup pass
- Tracked-by-accident data files (`data/relations/candidates.json` etc.) — gitignore hardening

## 2026-08-04 (AxiViewGroup shell + lock app to viewport)

Landed a local two-pane layout primitive and rewired the longform reader
to use it, while also fixing the long-standing double-scrollbar on pages
that forgot to clip their height.

- **AxiViewGroup** (`feat(shared)` `7769230`, 5 files, +480/-2): new
  reusable component under `app/components/shared/AxiViewGroup.{tsx,scss}`
  with slots `aside / asideTitle / asideActions / title / description /
  actions / footer / asideWidth` (default 240px). Ported from
  `shared/axi-ui/packages/shell/src/view-group.tsx` with the
  `AxiIconButton` / `AxiSvgIcon` / locale collapse controls stripped.
  Registered through `app/components/shared/index.ts` barrel and the new
  `_axi-components.scss` `@use` line.
- **`app/components/shared/MANIFEST.md`** first published: structured
  index of the 5 currently-registered Axi components (ThemeToggle /
  AxiSwitchButton / AxiGlobalSearch / AxiEventCard / AxiViewGroup) with
  absolute paths, props, and usage examples.
- **`refactor(longform)` `332f3b2`** (2 files, +360/-259):
  `LongStoryView.tsx` now imports `AxiViewGroup` via the barrel and the
  page becomes a MasterList + single-table layout instead of three
  per-generation grid columns. `_longform.scss` deletes the
  `GenerationColumn` rules, adds `.longform-master-list /
  .longform-master-item / .longform-pane-title / .longform-view-group`,
  and routes the gold high-contrast text through
  `var(--axi-color-text-on-primary, #0C1224)` so it passes the
  `npm run tokens:consistency` check as a defensive fallback.
- **`chore(shell)` `2c7af59`** (4 files, +44/-17): `main.scss` locks
  `html/body/#root` to `100%` height with `overflow:hidden`, antd
  Layout moves from `minHeight:100vh` to `height:100vh`, Content loses
  its padding and is given `overflow:hidden`, `.axi-page` becomes a
  flex column with `height:100%` + 10px padding (no max-width cap), and
  AxiViewGroup's internal padding aligns to the same 10px rhythm.
- **`docs(agents)` `32a002e`** (1 file, +31/-5): new "Trigger
  (mandatory for every agent)" block forces reading
  `app/components/shared/MANIFEST.md` before any UI primitive work;
  "Cross-workspace note" clarifies that the historical
  `axi-workbench/packages/ui` and `shared/axi-ui/packages/shell/src/`
  references are illustrative only; rule 4 makes the MANIFEST move with
  every registry change.
- **`chore(repo)` `efdf85f`** (1 file, +3): `.gitignore` adds
  `/.workbuddy/` so the cross-project user-session diary never lands in
  this repo.

Verification:

- `node --test app/server/evidence-store.test.mjs` → 22 tests,
  21 pass + 1 pre-existing failure (`getCandidate ... missing id → null`,
  unchanged by this batch and already documented in `docs/HANDOFF.md`).
- `npm run tokens:consistency` → 6/6 ✓ token consistency OK
- `npm run build` → ok (~2.5s)
- `python3 -m unittest -q tests/test_evidence_pipeline.py` → 10/10
- `python3 -m unittest -q tests/test_event_features.py` → 9/9

## 2026-08-04 (timeline coverage fill, 5 events)

Following the audit recorded just below, inserted 5 high-confidence missing
events into both `series-events.json` and `db/graph.db::timeline_events`,
regenerated `data/timeline/timeline-view.json`, and ran the full verification
suite.

| id | order | era | title |
|---|---|---|---|
| `wy-xiyu-split-and-accident` | 359 | betrayal | 夕郁被撞,与王越感情线彻底断裂 |
| `wy-fengyun-hui-initiation` | 242 | inhouse | 王越正式入会风云会 |
| `bo-long-and-yang-qiong-dead` | 325 | betrayal | 博龙与杨琼被逼死,留下龙凤胎 |
| `linran-married-and-withdrew` | 665 | afterglow | 林然结婚退出江湖,后丧夫独力带两孩 |
| `boyu-ao-and-ci-renamed` | 409 | elder | 博雨傲、博雨慈改名王龙、王慈 |

Implementation notes:

- All 5 events include `book_id` (mapped to the canonical English slug from
  `BOOK_CN_TO_SLUG`), `act` (whitelist: 结拜 / 背叛 / 分手 / 抚养),
  `theme` (whitelist: 结拜 / 情感断裂 / 真相揭示 / 抚养遗孤),
  `plot_kind` ∈ {turning_point, medium}.
- `location_id` uses the existing `zou_zhe:loc:fang-jia` /
  `zou_zhe:loc:ktv` / `xiong_di:loc:jian-yu` / `xiong_di:loc:xue-xiao`
  seeds — no new locations invented.
- `timeline_events_people` populated for each event so the formal arc set
  can pick them up next time `build-timeline.mjs` runs in build-script
  mode. `wy-xiyu-split-and-accident` registers 王越 / 夕郁 / 默婉 / 林然 /
  夕阳, so a future arc could join `wy-and-linran-break-up (142)` →
  `wy-xiyu-split-and-accident (359)` to close out the 爱情线三角.
- The previously recorded `wy-linran-first-love (120)` summary still says
  "林然嫁给柱子" — this is technically inaccurate (柱子 is a friend of
  王越, 林然后来嫁给另一个人, see xiong_di L60767-L60789). The new
  `linran-married-and-withdrew (665)` event supersedes that claim; the
  older summary will be reconciled in a follow-up pass.

Verification:
- `node data/timeline/build-timeline.mjs` → eras=6 events=63 arcs=18 people=37
- `python3 -m unittest -q tests/test_evidence_pipeline.py` → 10/10
- `python3 -m unittest -q tests/test_event_features.py` → 9/9
- `node --test app/server/evidence-store.test.mjs` → 21/22 (1 pre-existing
  failure unchanged)
- `npm --prefix app run build` → ok (~2.7s)

## 2026-08-04 (token consistency pass)

- Made `app/styles/main.css` import the **generated**
  `app/tokens/dist/css/variables.css` instead of re-declaring the dark + light
  `--axi-*` blocks inline. The file now only declares the shadcn-compatible
  HSL components (`--background`, `--foreground`, ...), the legacy bridge
  (`--axi-legacy-*`) consumed by graph/chain/scope views, and the light-mode
  re-binds for the legacy bridge + shadcn tokens. The runtime now actually
  picks up `npm run tokens` regenerations; previously the generated CSS file
  was dead code.
- Added `app/styles/_tokens.scss` §15 **Legacy hex aliases**: a complete
  `$legacy-text-*`, `$legacy-bg-*`, `$legacy-accent-*` catalog that maps every
  pre-Axi hex literal used by `_base.scss`, `_shell.scss`, `_chain.scss`,
  `_scope.scss`, and the legacy `.story-*` block of `_longform.scss` to a
  `$`-prefixed SCSS alias. This removes the silent duplication between the
  legacy partials and the Axi tokens.
- Replaced 270 raw-hex literals across the legacy view partials with the
  `$legacy-*` aliases. Hex literals now appear only:
  - inside `var(--token, #fallback)` as defensive CSS fallbacks;
  - inside the legacy `.story-*` block of `_longform.scss` where the color
    was a one-off pre-Axi value not yet bound to an Axi token.
- Added `_timeline.scss` `@use 'tokens' as *` so it can resolve
  `$legacy-accent-blue` / `$legacy-accent-purple` / `$legacy-accent-ink`.
- New check `app/scripts/check-token-consistency.mjs` (npm script
  `tokens:consistency`) enforces six invariants:
  1. `main.css + variables.css` `:root` keys match `admin.json css.root`
  2. The light block (in `variables.css`) keys match `admin.json css.light`
  3. A runtime entry (main.tsx/layout.tsx/styles/main.css/styles/main.scss)
     actually imports `tokens/dist/css/variables.css`
  4. `theme.ts` imports the generated `tokens/dist/ts/tokens.js`
  5. `_tokens.scss` `@import`s the generated `tokens/dist/scss/variables`
  6. No SCSS view partial contains a raw hex literal outside `var(...)`
- Verification:
  - `npm run tokens:consistency` → ✓ token consistency OK (6/6)
  - `npm run tokens:check` → ✓ tokens up to date
  - `npm run build` → ok (~2.5s)
  - `python3 -m unittest -q tests/test_evidence_pipeline.py` → 10/10
  - `python3 -m unittest -q tests/test_event_features.py` → 9/9
  - `node --test app/server/evidence-store.test.mjs` → 21/22 (1 pre-existing
    failure unchanged)

## 2026-08-04 (timeline coverage audit)

A read-through of `series-events.json` (58 events / 6 eras / 37 people) against
the four core novels (`一起混过的日子` / `哥几个，走着` / `我们是兄弟` / `辉煌岁月`)
turned up the following gaps. The fifth book, `像六哥一样活着`, is intentionally
absent from the timeline — its world is self-contained (童超), and it only
appears as a 消歧 reference for the alias `李纪宝` in `people.json`.

### A. Likely missing events (high confidence)

These are referenced repeatedly in the source novels but have no matching
event in the timeline:

| # | Candidate | Source evidence | Suggested placement |
|---|-----------|-----------------|---------------------|
| A1 | **王越与夕郁正式分手 / 夕郁撞车事故** — 默婉在王越生日宴上挑拨,夕郁赌气离开,当晚在马路上被车撞,差点死掉,从此沉默寡言 | `哥几个，走着.txt` L21613 / L22260(默婉坦白) / L37067(夕郁回忆) | 介于 `wy-farewell-linyifei` (358) 与 `wy-stabs-qiangwu` (360) 之间;是 `wy-and-linran-break-up` (142) 之后感情线的终局 |
| A2 | **林然最后与柱子 / 李安离 结婚 / 林然嫁给柱子** — 这是林然感情线的收束,与 `wy-linran-first-love` (120) 呼应 | `一起混过的日子` 后期(林然感情线) + `哥几个，走着.txt` 多次提及"柱子" | 应作为 `linran-final-farewell` (670) 的前态;目前 timeline 只在 `wy-linran-first-love` summary 提了一句"林然嫁给柱子",没有独立事件 |
| A3 | **林逸飞被砍 / 险些被强五一方打死** — 默婉坦白时还提到"螃蟹要开枪打死我的时候,都站在我身前",林逸飞对默婉的爱到最后一刻 | `哥几个，走着.txt` L22260 | 应紧贴 `bl-defects` (320) 之前/之后,作为 `lin-yi-fei-collapse` 的关键触发 |
| A4 | **林逸飞母亲、螃蟹与林县长的政治交易 / 林老爷子上位** | `哥几个，走着.txt` L28798 / L28806 / L28812 等 | 应纳入 `inhouse` 或 `betrayal` 收尾,是 `wy-imprisoned-on-mountain` 的现实诱因 |
| A5 | **王越正式入方家 / 风云会入会仪式(歃血为盟)** | `哥几个，走着.txt` L23587-L23615,李耀亲自主持 | 应置于 `wy-bl-sworn` (310) 之前或紧贴 `wangyue-promoted` (240) 之后,作为"王越成为方家核心"的具象化仪式 |
| A6 | **王越与夕郁相识并在一起(完整恋爱段)** — 当前 `wy-meets-xiyu` (130) 仅提"另一条感情线开启",缺少与林然的三角展开 | `一起混过的日子` 多卷(尤其初中卷 + 高中卷),约【017】夕郁 起 | 应对应 `一起混过的日子` 初中/高中早期,在 `wy-meets-xiyu` (130) 之后补一两个里程碑 |
| A7 | **王越与博龙在大学的兄弟情(博龙一见钟情 / 同宿舍)** | `哥几个，走着.txt` L473-L573 | `wy-school-starts` (110) 提到"初中兄弟团",但 `wy-bl-sworn` (310) 之前的大学阶段没有任何事件,把结拜和前期日常跳过去了 |
| A8 | **博龙死 / 杨琼之死 / 王龙王慈沦为孤儿的直接事件** — 现有 `wanglong-orphaned-and-raised` (405) 仅提"被逼死",但**博龙是王越的结拜兄弟,死亡事件本身**应在 betrayal era 出现 | `我们是兄弟.txt` L59 / L4848 / L6221 / L10180-L10182 / 后续章节 | 应在 `wy-finds-bl-children` (340) 之前增加 `bl-and-yangqiong-dead` 类事件,与 `bl-defects` (320) 形成"出卖 → 死亡"因果链 |
| A9 | **博雨傲与博雨慈被安排改名"王龙 / 王慈"** — 这是兄弟卷叙事的起点 | `我们是兄弟.txt` L67(王越念王龙身份证) | 紧贴 `liu-zhen-dong-raises-wanglong` (408) 之后,或合并进 `wanglong-orphaned-and-raised` (405) 的 summary |
| A10 | **大钟遇刺后凶手(李鸿儒方)落网 / 王龙后续博弈** | `我们是兄弟.txt` 反复出现"大钟进医院" | 紧贴 `wanglong-first-blood` (415) 之后 |
| A11 | **夕念的出生 / 夕念身份揭晓给夕阳** — 这是兄弟卷后期最关键的家庭线转折 | `我们是兄弟.txt` L70568-L70688 | 应纳入 elder era 中段(与 `wangci-xinian-romance` (475) 配套),目前 `wangci-xinian-romance` 只提"两人相遇相恋" |
| A12 | **屠夫 / 不夜城 / 人间仙境 / 王巍被灭** — 王龙权力版图成形的最大外部对手 | `我们是兄弟.txt` 后期 | 应置于 `wanglong-power-map` (480) 之前,与 `wanglong-inherits-wangwei` (485) 呼应 |

### B. Era / order concerns (medium confidence)

1. **`wy-meets-shengge` (215) 比 `enters-shengge-circle` (220) 提前,** 但
   在 `哥几个，走着` 里 林逸飞 引荐王越见盛哥 本就是进入方家的入口 — 两事件
   内容重叠,可考虑合并或显式注明依赖。
2. **`lin-yi-fei-collapse` (330) 与 `lin-yi-fei-collapse-detail` (332) order
   编号相邻且 reason / impact 高度雷同**,实际上是同一事件的两个粒度。建议
   合并为 `lin-yi-fei-collapse` 并把"出国避难"塞进 summary 末尾,或者把
   detail 改为"林逸飞去机场/出国路途"以拉开语义。
3. **`wy-bl-sworn` (310) 出现在 `betrayal` era 的第一条** — 但博龙与王越是
   高中同学+大学室友,实际结拜时间应早于 `inhouse` 末尾。考虑把 era 改为
   `inhouse` (210 段),或显式说明 `betrayal` era 从"博龙与王越结拜"开始。
4. **`wanglong-songyang-leverage` (445) 与 `wanglong-songyang-trust` (446)**
   order 几乎相邻,但语义上是同一事件的"前/后"。`445` 的标题"唐焱交底"
   在原文中实际发生在王龙已经接班之后,而 `446` 才是玉佩真相的呈现 —
   **疑似颠倒了**。建议把 `446` 的内容下沉到 `wanglong-finds-father-figure`
   (440),把 `445` 改为"宋洋筹码揭晓"。
5. **`wanglong-yungege` (412) order=412** 排在 `wy-becomes-elder` (410)
   之后,但 云格格 与 王龙 在 op 市 KTV 相遇时,王越尚未被写成"传奇前辈"
   — 这只是 era 内的相对顺序,问题不大,但需要确认 `wy-becomes-elder` 的
   时间锚(王越何时被称"殇胜元老")。
6. **`wanglong-inherits-wangwei` (485) 在 `wanglong-power-map` (480) 之后**,
   但原文中王巍死亡与王龙接班几乎同步 — 考虑把 order 调成 480/485 同步或
   显式拆为"王巍死后 / 王龙接班"。
7. **`wangli-revealed` (530) 与 `wangli-debut` (605) 内容重复**(都是王力
   登场),且 `raise` era 中只有 3 个事件,密度过低;`wangli-revealed` 实际
   承担的语义是"王力与王龙无血缘、属盟友体系下一代",可以挪到 `people`
   summary 里,不需要单独事件。
8. **`wy-linfei-back` (650) 是 `INFERRED` 事件**,且 `wy-final-closing`
   (660) 已经隐含了这层意思,二者高度重合。建议保留其一。

### C. 顺位(时序)与书中情节的整体对照

把 58 事件按 era 切成 6 段后,与 4 本书的章节范围基本对得上:

| Era | Order 范围 | 主要书卷 | 主要章节范围 | 覆盖度 |
|---|---|---|---|---|
| youth (10) | 110-142 | `一起混过的日子` 初中卷 + 高中卷 | 【001】~【1149】 | ⚠️ 中。覆盖林然 / 夕郁感情线,但缺少大学段过度和分手细节(见 A1) |
| inhouse (20) | 210-240 | `哥几个，走着` 第一卷~中段 | 【003】~【170】(乔炫 ~ 正式入伙) | ✅ 中。缺少入会仪式(见 A5) |
| betrayal (30) | 310-380 | `哥几个，走着` 中后段 | 【200】~【1400】(盛哥登场 ~ 林然盒子) | ⚠️ 中。博龙之死缺席(见 A8),兰兰身份与原文偏差(见 D1) |
| elder (40) | 400-490 | `我们是兄弟` 序章~全本 | 序章 + 【001】~【1146】 | ⚠️ 大体覆盖,但缺少屠夫/不夜城、夕念出生、王龙得知身世之前的中间博弈(见 A11/A12) |
| raise (50) | 510-530 | 横跨三本书的"抚养期" | 隐含,无单卷对应 | ⚠️ 概念完整但具体事件稀疏,只剩 3 条 |
| afterglow (60) | 605-685 | `辉煌岁月` + 兄弟卷后期 | `辉煌岁月` 全本 + `我们是兄弟` 后期 | ⚠️ 中。王力婚后/入狱前的人生细节、`辉煌岁月` 中反派董事长(宝哥 / 万宝集团)的具体登场都缺失 |

**结论:大约有 12 个明确遗漏 + 6 处顺序/合并问题需要后续补齐。**

### D. 内容/语义偏差 (low confidence)

1. **`lanlan-appears` (380) 的 summary 把它说成"父辈安排的挑拨者"** — 但
   原文中兰兰是一位独立 KTV 女招待(`哥几个，走着.txt` L123426 起),**她
   本身没有挑拨王越 / 林然**;真正挑拨的是默婉 + 夕郁。`lanlan-appears`
   这条事件的根据不明,需要回查 evidence-store 是否能对上原文段落。
2. **`wanglong-finds-father-figure` (440)** 描述王龙浑身刀伤闯工厂找王越
   — 这确实是《我们是兄弟》序章开篇,但**"找到"≠"认亲成立"**。认亲的
   后续(王越追忆、刘震东介绍、唐焱交底)在 `445`/`446` 才展开。这条
   timeline 没问题,只是 `445`/`446` 拆分得太碎,见 B4。
3. **`wy-finds-bl-children` (340)** 把"博雨傲 / 博雨慈"作为博龙子女 —
   这与 `bo-hai-tao-abandons` (425) 一致,但 `people.json` 中
   `bo-yu-ao` / `bo-yu-ci` 是否被独立登记需要确认(读 timeline-view
   应能看到)。
4. **`wanglong-inherits-wangwei` (485)** 的措辞"以大善人名号立 op 市"
   与原文中王巍基金的实际运作并不完全一致 — 王龙是继承了一笔基金/慈善
   资产,但"大善人"称谓属于王巍生前。王龙更多是"接盘"而非"自立"。

### E. 后续行动建议

- 短期:把 A1/A2/A5/A8/A9 这 5 条最重要、最容易从原文验证的遗漏加入
  `series-events.json` 并重跑 `build-timeline.mjs` + Node 验证。
- 中期:把 B1/B2/B3/B4 的合并 / 顺序调整做完;验证 B5/B6/B7/B8。
- 长期:补完 A3/A4/A6/A7/A10/A11/A12 这 7 条需要从原文中精确摘录的事件。
- D1 需要回查 evidence-store,定位兰兰是证据节点是来自哪一段原文,
  如果没有原文支持,建议把 `lanlan-appears` 改为 `wy-meets-mowan` 类的
  "核心反派登场"事件,或者直接删除。

- Added a row-count size guard for the read-only `db/graph.db` snapshot so the
  "single-readonly-SQLite" lane stays observable:
  - `app/server/evidence-store.mjs` exports `SIZE_GUARD_THRESHOLDS`
    (scenes 500k, chapters 50k, relation_candidates 50k,
    discovered_entities 50k) and a cached `checkSizeGuard(storeRoot)` that
    reads four `COUNT(*)`s, returns `{ exists, source, rowCounts, guards,
    summary }`, and `console.warn`s once when any threshold is crossed.
  - `loadSnapshot` reuses the guard result so the snapshot now carries a
    `sizeGuard` field.
  - `app/vite.config.ts` registers `GET /api/health` returning
    `{ ok, source, sizeGuard }` (loopback-only, same guards as the rest of
    the API surface).
  - Ambient types in `app/server/evidence-store.d.mts` cover the new
    `SIZE_GUARD_THRESHOLDS`, `SizeGuardEntry`, `SizeGuardSummary`, and
    `SizeGuardReport`.
- Added three Node test cases (`SIZE_GUARD_THRESHOLDS exposes the documented
  row-count ceilings`, `checkSizeGuard returns one entry per tracked table
  with explicit state`, `loadSnapshot surfaces the size guard alongside the
  snapshot`); all three pass.
- Smoke-tested `GET /api/health` against the live dev server: returns 200,
  `ok=true`, `summary.state="ok"` at current row counts (scenes 19,512,
  chapters 8,144, relation_candidates 623, discovered_entities 2,570).
- The decision to migrate to Postgres / MySQL is unchanged — the guard only
  raises a signal when the documented ceilings are crossed.

## 2026-08-04 (event card & stats cleanup)

- Redesigned the dedicated event card to be a focused, single-purpose surface
  (`axi-event-card` shared by longform and graph views). Each event card
  surfaces exactly the three required facets, in this order:
  1. **发生时间** — narrative era title + stable `order` index + the existing
     "时间线按故事顺序记录,不代表公历年份" hint
  2. **事件主人公** — main cast chips (gold-bordered) on top, then a
     `参与人物` row for the rest of the people list
  3. **事件具体内容** — a left-bordered content block that uses the full
     `summary` text
  Stage hint and primary book tags now live in a dedicated footer, and the
  `查看完整详情` link stays in the same place. Key-turning-point events get a
  red border + gold-bordered head separator. Implemented in
  `LongStoryView.tsx::EventSummaryCard` and `GraphExplorer.tsx::GraphEventCard`.
- Deleted every dashboard-style statistic from the workbench:
  - `LongStoryView`: removed the 4-up `longform-stat-grid` (阶段/关键事件/
    关系弧/人物) and the per-book event count `Badge` on the Book card title
  - `LongStoryView::Segmented` chapter nav now shows the chapter label only —
    no per-chapter event count
  - `TimelineView`: removed the 4-up `timeline-stat-grid` (叙事阶段/关键事件/
    关系弧/关键转折), the per-stage count badges inside `StageFilterPanel`,
    and the `X 条记录` badge on the event-index table
  - `TimelineView` "人物" column now shows stacked avatar chips of the first
    three main-cast people instead of `X 人`
  - `GraphExplorer` topbar: removed the `graph-arc-filter` arc-type pill row
    and the `arcTypeFilter` state — all formal arcs now render unconditionally
    behind the highlight filter
- Cleanup:
  - Removed unused `Statistic`, `BookOutlined`, `SwapOutlined`, `TeamOutlined`,
    `Statistic`, `Badge` imports where applicable
  - Removed `.longform-stat-grid` / `.timeline-stat-grid` rules and their
    responsive overrides; added `.axi-event-card-*` selectors plus
    `.timeline-table-people-*` for the avatar stack
- Verification:
  - `npm --prefix app run build` → ok
  - `python3 -m unittest -q tests/test_evidence_pipeline.py` → 10/10
  - `python3 -m unittest -q tests/test_event_features.py` → 9/9
  - `node --test app/server/evidence-store.test.mjs` → 18/19 (one pre-existing
    failure unchanged: `getCandidate returns evidence and consensus;
    missing id → null`)

## 2026-08-04 (brotherhood narrative enrichment)

- Rewrote the `wy-school-starts` event summary in `series-events.json` to spell
  out the youth brotherhood in concrete source detail (driven by
  `一起混过的日子.txt` L125-L218 / L660 / L692-L733 / L745-L751):
  - 林逸飞(飞哥)是本地五人宿舍的带头大哥,父亲是副县长、学校校长是元元
    的舅
  - 同宿舍的本地五人:林逸飞、元元(李元)、寸寸(赵寸)、小辫子(小志)、偏分
  - 王越是外地考入的,岁数最小个头最小,被叫小六;林逸飞第一晚就拉他入圈
  - 猩猩欺负王越同桌,林逸飞带兄弟冲进宿舍一棍打到猩猩肩膀;王越一人扛
    下处分,林逸飞搂着他说:够意思,没钱不要紧,有哥几个的
  - 通过打陈刚、与李旭讲和、陆续吸收齐思、胖子、李潇等成员,扩展成兄弟团
- Enriched `people.json` summaries for brotherhood members to reflect their
  actual narrative role:
  - `lin-yi-fei`: full brotherhood origin story + later 强五/默婉/夕阳/赵天
    联手搞垮出国
  - `hui-xu`: 兄弟团核心成员,与王越自初中校园时期起同行
  - `xing-xing`: 初中同班同学,因喜欢王越同桌扔王越,后被林逸飞一棍打到肩膀,
    并入兄弟团
  - `pang-zi`: 兄弟团早期成员,一起打架泡妞的伙伴
  - `li-xiao`: 校园时期兄弟团成员,与王越等一起经历同班打架与宿舍生活
  - `ban-zhu-ren`: 初中班主任,元元的姑姑是班主任的姑姑,任命王越为班长,
    多次在王越逃学/感情承压时找他谈心
- `wy-school-starts` now references all the brotherhood protagonists
  (王越、林逸飞、辉旭、臣阳、猩猩、班主任、胖子、李潇); the event also gets
  a fresh `change` linking 王越 ↔ 林逸飞 at 兄弟(庇护) so the formal arc set
  reflects the foundational relationship.
- Regenerated `data/timeline/timeline-view.json` (58 events, 6 eras, 18 arcs,
  37 people) and rebuilt `db/graph.db`; reran `scripts/pipeline/
  backfill_event_features.py` to refresh locations / event_edges. All
  pre-existing invariants still hold: 9/9 event-feature tests and 10/10
  evidence-pipeline tests.

## 2026-08-04 (theme switch)

- Added dark / light / system theme support on top of the Axi tokens:
  - `app/ThemeProvider.tsx`: React context with
    `useTheme()` returning `{ mode, preference, cycleMode, setPreference }`.
    Reads/writes `localStorage['story-graph-theme']`; when preference is
    `system`, mirrors `matchMedia('(prefers-color-scheme: light)')`.
    Sets `<html data-axi-mode="dark|light">` to drive the CSS layer.
  - `app/theme.ts`: replaced the `STORY_THEME` constant with
    `getStoryTheme(mode)` returning an antd `theme.darkAlgorithm` /
    `theme.defaultAlgorithm` config bound to `antdDarkTokens` /
    `antdLightTokens`. New types: `ThemeMode`, `ThemePreference`.
  - `app/components/shared/ThemeToggle.tsx`: topbar button that cycles
    dark → light → system, with sun / moon / desktop icons and a tooltip
    describing the next action.
  - `app/main.tsx`: wraps `<ThemeProvider>` around the existing
    ConfigProvider; `ThemedApp` re-reads `mode` from `useTheme()` and
    passes the result of `getStoryTheme(mode)` to ConfigProvider, so
    antd and the CSS layer switch together.
  - `app/layout.tsx`: adds `<ThemeToggle />` to the topbar `Space`.
  - `app/tokens/admin.json`: `css.light` now also binds
    `--axi-border-*` (rgba) and `--axi-shadow-*` so the legacy
    `$color-border-*` / `$shadow-*` SCSS aliases resolve to light
    values automatically. `antdModeTokens.light` introduced for the
    light algorithm config.
  - `app/scripts/build-tokens.mjs`: emits `antdLightTokens` alongside
    `antdDarkTokens`.

## 2026-08-04 (design tokens)

- Migrated the design token system to an Axi-aligned structure, mirroring
  `/Volumes/code/workspace/shared/axi-ui/packages/tokens`:
  - Single source of truth: `app/tokens/admin.json` (W3C Design Tokens
    format with `$value` / `$type`).
  - Generator: `app/scripts/build-tokens.mjs` produces
    `app/tokens/dist/{css,scss,ts}/*` (CSS variables, Tailwind theme, SCSS
    aliases, TS module). Idempotent; `npm run tokens:check` exits non-zero
    when the artifacts are stale, suitable for CI.
  - Primary brand color unified to **#E5B94A** (was #f4bf58).
- Wired the generated artifacts into the three runtime surfaces:
  - `app/theme.ts` now reads from the generated TS module
    (`axiTokens.color.*`); no hardcoded hex.
  - `app/styles/_tokens.scss` `@import`s the generated `_variables.scss`
    and forwards all legacy `$color-*` / `$space-*` / `$font-*` names so
    existing component partials keep working. The Sass `@import`
    deprecation warning is intentional here (we need flat $-vars in the
    global namespace).
  - `app/tailwind.config.ts` rebinds colors / radii / fonts / shadows
    to `var(--axi-*)`. The shadcn-style HSL surface (`bg-background`,
    `text-foreground`, etc.) is preserved.
  - `app/styles/main.css` re-declares `--axi-*` (hex) and the
    `--background` / `--primary` etc. (HSL triples) consumed by
    `bg-*` / `text-*` utilities, plus a `data-axi-mode="light"`
    re-bind placeholder for future theme switching.
- Added npm scripts: `tokens` (rebuild) and `tokens:check` (CI guard).

## 2026-08-04 (data fill pass 2)

- Filled the remaining nullable columns and improved backfill coverage:
  - timeline_events.theme: 58/58 (was 0/58), keyword-derived whitelist
    covering 结拜 / 背叛 / 情感断裂 / 初恋 / 刺杀 / 告别 / 抚养遗孤 /
    崛起 / 退隐 / 复仇 / 和解 / 真相揭示 / 回归 / 囚禁 / 认亲 / 其他.
  - timeline_events.location_id: 20/58 (was 0/58), resolved by keyword
    match on summary/title against the LOCATION_SEEDS map.
  - timeline_events.plot_kind: 30/58 (was 4/58), by mirroring the full
    INFERRED_EVENTS / SINGLE_SOURCE_EVENTS / TURNING_POINT_EVENTS sets
    from `data/timeline/build-timeline.mjs`.
- Expanded `data/timeline/people.json` by 8 entries (李潇 / 猩猩 / 班主任 /
  彭刚 / 暴君 / 东哥 / 胖子 / 沈璐) so the 12 previously-unmatched
  graph_edges persons are at least documented. None of these are
  referenced in series-events.json.people, so formal event_edges count
  is still capped at 3/15 (4/15 by canonical, one event is missing the
  pair 李封+臣阳 in a single event). This is a data-source ceiling, not
  a script issue.
- tests/test_event_features.py: 9 invariants now (was 7); added
  `test_theme_populated_and_in_whitelist` and `test_location_id_some_resolved`.

## 2026-08-04 (schema upgrade)

- Upgraded `timeline_events` to the "人物/情节/环境" three-element model.
  Added 7 nullable columns: `book_id`, `location_id`, `plot`, `act`,
  `outcome`, `theme`, `plot_kind`. `act` whitelist = {入局 / 结拜 / 背叛 /
  反目 / 抚养 / 崛起 / 分手 / 重逢 / 刺杀 / 退隐 / 觉醒 / other}.
  `plot_kind` whitelist = {inferred / medium / turning_point / null}.
- New tables: `locations` (book-scoped places with kind + aliases) and
  `event_edges` (timeline_events <-> graph_edges / relation_candidates,
  edge_kind in {formal, candidate}, UNIQUE(event_id, edge_kind, edge_ref_id)).
- `books` table now has 5 rows (was 4). The missing `liu_ge` ("像六哥一样活着",
  series='独立作品') is backfilled from `data/evidence-store/catalog.json`
  via INSERT OR REPLACE; status != 'ready' rows are filtered out.
- `BOOK_IDS` canonicalised to English slugs (hun_guo/zou_zhe/xiong_di/
  hui_huang/liu_ge) so `books.id`, `graph_edges.source/target`,
  `entity_registry`, and Node `evidence-store.test.mjs` share one
  namespace. Chinese source keys (`relations.json`, `wangyue/*.json`,
  `candidates.json`) are reconciled via `BOOK_CN_TO_SLUG` in
  `scripts/pipeline/migrate_sqlite.py`. Side effect: the Node test
  "overview per-book totals add up to formal totals" (previously a
  known failure) now passes, leaving **1 known Node failure** instead
  of 2.
- New `scripts/pipeline/backfill_event_features.py` idempotently fills
  the new columns and tables. Coverage after first pass:
  - timeline_events: 58/58 book_id + plot + act, 36/58 outcome, 4/58 plot_kind
  - locations: 35 rows (5 books x 7 seed places)
  - event_edges: 87 rows (3 formal + 84 candidate)
- New `tests/test_event_features.py` with 7 invariants (book_id populated,
  act / plot_kind whitelists, event_edges no cross-book, locations seeds).

## 2026-08-04

- Stopped the stale `vite` instance that was holding port `4173` from the
  rollback checkout at `/Volumes/时光杂货铺/.../story/app`; restarted the
  canonical `npm --prefix app run dev` from the workspace path (vite 7.3.6,
  ready in ~120ms, HTTP 200 on `http://127.0.0.1:4173/`).
- Re-ran the three-piece registration check from the canonical path:
  `workspace-project validate` ok, `workspace-audit.mjs` 0 errors,
  `pnpm workspace:docs:sync` refreshed.
- Re-ran project-level verification: Python tests 10/10 OK, smoke `app/package.json && db/graph.db` OK, Node tests still reproduce the same 2 known failures (`overview per-book totals add up to formal totals`, `getCandidate returns evidence and consensus; missing id → null`).
- Refreshed `docs/HANDOFF.md` and `docs/project-docs.manifest.json` to mark
  `lastVerifiedAt = 2026-08-04` and to enumerate the two known Node failures
  by name so the next agent does not have to rediscover them.
- Noted (not fixed) the Tailwind content warning on `./**/*.ts` matching
  `node_modules`; deferred until the next viewer-side cleanup pass.

## 2026-08-03

- Migrated the repository to `/Volumes/code/workspace/products/story-graph`.
- Preserved the existing Git history, branch, remote, source corpus, graph
  artifacts, and uncommitted work.
- Added workspace handoff and verification documentation.
- Rebased documentation and evidence catalog paths on the canonical workspace
  checkout.
