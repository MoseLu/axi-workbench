# auto-submit 2026-08-18 axiom-docs ↔ axiom-ui sync

## Task / Feature Goal

同步 `axiom-docs` 文档与刚在 `axiom-rules` 注册的 AR-ROUTING-007（@axi/* 新消费者走 INTEGRATION.md）以及当前 `shared/axi-ui` 实际结构，让 axiom-docs 的"权威源表"指向 axiom-ui 的两条文档入口（消费者入口 + 维护者入口），并把 ARCHITECTURE-AXI-STACK.md 的引用矩阵扩到 4 列（axiom-skills × axiom-rules × axiom-docs × shared/axi-ui）。

## Changed Paths Summary

- `AGENTS.md` — Authoritative Sources 表新增 2 行（`shared/axi-ui/docs/INTEGRATION.md`、`shared/axi-ui/INDEX.md` + `docs/axi-ui/COMPONENTS.md` / `PUBLIC_API.md` / `RELEASES.md`）；最后更新日期 2026-08-18。
- `ARCHITECTURE-AXI-STACK.md` — §6.6 引用矩阵加 `shared/axi-ui` 列；§10 引用表补 `axiom-rules/rules/agent-routing/AGENTS.md` 与 `shared/axi-ui/docs/INTEGRATION.md` / `INDEX.md`；最后更新日期 2026-08-18。
- `INDEX.md` — Document Map 末两行加 `shared/axi-ui/docs/INTEGRATION.md` 与 `shared/axi-ui/INDEX.md`（外部权威入口）。
- `docs/logs/submit/20260818-axi-ui-sync-auto-submit.md` — 本次 sync 的提交日志（AR-GIT-003）。

## Verification

文档交叉引用改动，无构建产物需要回填。

- 手工 diff 复核：本文件外只动了 `AGENTS.md`、`ARCHITECTURE-AXI-STACK.md`、`INDEX.md` 三个文档。
- 同步 commit 的 axiom-rules 改动：`axiom-rules` HEAD fa2ddbb 通过 `python3 scripts/validate-index.py`。

## Created Commit SHA(s)

- axiom-docs: `ff8f871` (docs(sync): surface shared/axi-ui INTEGRATION.md + INDEX.md as authoritative entries)
- axiom-rules（同伴 commit）: `fa2ddbb` (sync(axi-ui): surface 9 @axi/* + gallery reference + new consumer INTEGRATION entrypoint)

## Push State

未推送（本地 `dev` 分支落地即视为完成）。

## Remaining Risks / None

- `docs/content/{en,zh}/projects/` 中 axiom-ui 的项目档案未同步更新 — 那是 axiom-docs 内容源的常规翻译流水线，不在本 sync 范围。
- axiom-docs 站点构建未跑（构建由 axiom-docs 自身维护；本次只动交叉引用与权威源表）。

Confidence: High（变更与 axiom-rules AR-ROUTING-007 + shared/axi-ui 现状一一对应）。
Tested: axiom-rules validate-index（同伴 commit fa2ddbb）。
Not-tested: axiom-docs 站点构建。
Scope-risk: Low（只新增文档指针，不改任何运行时行为）。
Directive: 落地即视为完成。