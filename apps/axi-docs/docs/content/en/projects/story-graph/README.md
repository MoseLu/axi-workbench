---
id: axi-docs-en-projects-story-graph
title: Story Graph (Pure-Silver-Earring Jianghu Series Relationship Graph Workbench)
type: project
status: published
tags: [Axi Docs, Projects, products, story-analysis, evidence-driven, react]
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

> Mirror of the project root `README.md` plus deep dives into the
> evidence-driven pipeline, the SQLite snapshot, and the React/Vite
> viewer. Source of truth:
> [`/Volumes/code/workspace/products/story-graph/README.md`](/Volumes/code/workspace/products/story-graph/README.md).
> Section: core / Partition: `products/`.

## Summary

Story Graph is the canonical `story-graph-workbench` product in the
Axi workspace. It is an evidence-driven local novel relationship graph
workbench for the **纯银耳坠江湖系列** (four novels: `一起混过的日子`,
`哥几个，走着`, `我们是兄弟`, `辉煌岁月`). The product reads only
"证据闭环" (evidence-closed) events in the default longform view;
candidate relations stay in a review queue and never get auto-promoted.
It is composed of three layers: a Python pipeline (corpus ingestion,
candidate discovery, double-model consensus, publication, audit), a
SQLite evidence layer (rebuildable query artifact of
`data/evidence-store/graph.json`), and a React 19 / Vite / antd 6
viewer with strict loopback binding.

The project has gone through a v1 → v2 evolution; v2 (re-verified
2026-09-14) covers 6 eras / 82 events / 18 arcs / 60 people with
Python 19/19 OK, Node 27/27 OK, TypeScript 0 errors, Vite build
~4.8s, and a fully consistent Axi token check. The `_graph/` legacy
checkout is preserved as a rollback copy until the migration is
explicitly retired by the owner; all development now happens under
`app/` (React/Vite viewer), `scripts/pipeline/` (Python), `data/` and
`db/` (storage).

**Stage**: live product (v2 complete; v3 evaluation pending).
**Canonical path**: `/Volumes/code/workspace/products/story-graph`.

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

Do not split `app/` into a separate repository; the viewer reads the
evidence store directly via `app/server/evidence-store.mjs` so the
seam between Vite dev server and SQLite snapshot is local.

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

Health: `test -f db/graph.db`.

## Architecture Highlights

The evidence-driven pipeline is the heart of this project. `scripts/pipeline/evidence_pipeline.py` is a stdlib-only Python
pipeline that ingests the four `.txt` novels, chunks them, surfaces
candidate entity/relation triples via a strict trigger-word taxonomy
(`亲属 / 恋爱 / 朋友/结拜 / 敌对 / 上下级 / 师承 / 组织归属 /
合作 / 事件参与者`), and feeds them to a **double-model consensus**
process (a local LLM judge + the cloud MiniMax reviewer in
`minimax_review.py`). Two independent decisions must agree, both must
reference at least two locatable source quotes, and confidence must be
≥ 0.85 before an edge is allowed into `graph.json`. The current
`graph.json` contains exactly 15 published edges; `candidates.jsonl`
holds 608 awaiting review. Person IDs are deliberately namespaced as
`book_id:person:规范名` and **never auto-merged across books** — a
character named the same in two novels is two distinct nodes.

The SQLite layer is a **rebuildable query artifact**, not the source of
truth. `scripts/pipeline/migrate_sqlite.py` reads
`data/evidence-store/graph.json` and rebuilds `db/graph.db`. The
loopback data server in `app/server/evidence-store.mjs` reads SQLite
when it is newer than the corresponding source JSON/JSONL files, and
falls back to JSON otherwise — the mtime policy and the
`SIZE_GUARD_THRESHOLDS` (scenes 500k, relation_candidates 50k,
discovered_entities 50k, chapters 50k) are explicit so that when the
snapshot starts to feel slow the team revisits the
single-readonly-SQLite decision before users notice. The
`evidence-store.mjs` data layer is read-only by contract; candidate
data is never used to derive official edges; size guard counts feed
the audit panel. The same module also caches reads by
mtime/sqlite_mtime so repeated filter requests don't re-parse.

The React/Vite viewer (`app/`) splits responsibilities into five
routes (`graph`, `longform`, `chain`, `scope`, `timeline`) plus a
shared `AxiViewGroup` dual-pane layout for longform. The local Axi
component barrel (`app/components/shared/index.ts` +
`AXI_COMPONENTS_REGISTERED` tuple + `app/styles/_axi-components.scss`)
is enforced: `ThemeToggle`, `AxiSwitchButton`, `AxiEventCard`,
`AxiThemeArc` are the four currently registered local components;
upstream primitives (`@axi/shell` `AxiSidebar`, `AxiTopbar`,
`AxiViewGroup`; `@axi/crud` `AxiCrudLayout`, `AxiSearchKey`,
`AxiTable`; `@axi/core` `AxiTag`, `AxiPage`, `AxiIconButton`) are
imported directly from their workspace packages and consumed via the
`workspace:^` reference in `app/package.json`. Pages must never import
the component file directly — the barrel-and-MANIFEST rule exists to
stop reinvented primitives.

The narrative reading layer v2 (DESIGN.md, 2026-08-05) replaced the
old "event count + dashboard chrome" longform with a **主线地图 +
五段式事件账本** ("main-line map + five-segment event ledger"). The
default `/story/longform` route opens with a left aside (`MasterList`
covering 全部 / 一代 / 二代 / 三代) and a right main with the three-
generation narrative spine + five-segment event ledger. The graph
explorer reads left-to-right by story phase (王越 → 王龙 → 王力 are the
emphasized first/second/third-generation continuation points); every
event card surfaces exactly three facets — `发生时间` (era + stable
order index), `事件主人公` (gold-bordered protagonist chips + supporting
people pills), `事件具体内容` (the full `summary` in a left-bordered
block). No view renders `Statistic` / dashboard counters. The
brotherhood narrative context for `wy-school-starts` lives entirely
inside `data/timeline/people.json` + the event summary and does **not**
introduce any new formal `graph.json` edge.

Token consistency is part of the build pipeline. `app/scripts/build-tokens.mjs`
generates `tokens/{admin.json, light blocks}`; `check-token-consistency.mjs`
asserts that `main.css / variables.css / light blocks` agree with
`admin.json`; `foundation/axi-ui/scripts/check-design-tokens.mjs` and
`check-ui-aesthetic.mjs --strict` are wired into `pnpm --dir app
check:*` so the bar is "design tokens and aesthetic discipline must
stay consistent across upstream Axi primitives and local overrides".

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

See `docs/state/MILESTONE.md` for the live milestone document.

## Notes

- The PRD P0 safety constraints — "formal edges only from `graph.json`", "candidate relations never auto-promoted", "loopback binding only", "`data/evidence-store/` is a fact boundary" — are non-negotiable.
- The `_graph/` legacy compatibility shell is unique to this project and is the only candidate for formal retirement in the v3 evaluation.
- The Axi UI primitives consumed via `@axi/*` `workspace:^` come from `foundation/axi-ui/` — the upstream Axi UI monorepo.
- This is the only product with an `app/server/evidence-store.mjs` data layer; do not treat it as a pattern to copy into other products without explicit owner approval.

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
- The Axi UI primitives consumed via `@axi/*` `workspace:^` come from [`/Volumes/code/workspace/foundation/axi-ui/`](/Volumes/code/workspace/foundation/axi-ui/) — the upstream Axi UI monorepo. The AGENTS.md cross-workspace note explicitly warns that earlier docs referencing `axi-workbench/packages/ui` or `foundation/axi-ui/packages/shell/src/` may be illustrative starting points only.
- This is the only product with an `app/server/evidence-store.mjs` data layer; do not treat it as a pattern to copy into other products without explicit owner approval.
- The `_graph/` legacy compatibility shell is unique to this project and is the only candidate for formal retirement in the v3 evaluation.