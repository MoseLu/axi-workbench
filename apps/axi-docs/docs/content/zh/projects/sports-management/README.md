---
id: axi-docs-zh-projects-sports-management
title: Axi 体育管理应用（已归档）
type: project
status: published
tags: [Axi Docs, 项目, archive, quasar, vue3, capacitor, typescript, sports-management, deprecated]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi 体育管理应用（已归档）
graph-tags: [Projects, archive, deprecated]
description: 已归档的 Quasar + Vue 3 + Capacitor 体育管理应用骨架。`status: archived`（2026-09-17 归档）。从未越过脚手架阶段；作为"文档-代码错配"教训与分支策略学习的参考。技术栈：`Quasar 2` + `@quasar/app-vite ^2.1.0` + `Vue 3 ^3.4.18` + `Pinia ^3.0.1` + `Vue Router ^4.0.12` + `Vue I18n ^11.0.0` + `axios ^1.19.0` + `@capacitor/core ^7.0.0` + `@capacitor/android ^7.0.0` + `Vite 5` + `ESLint ^9.14.0` + `Prettier ^3.3.3` + `Vitest ^2.1.9` + `vue-tsc ^2.0.29`。
project:
  id: sports-management
  partition: archive
  path: /Volumes/code/workspace/archive/axi-sports-management-app
  status: archived
  archived-on: 2026-09-17
  source-section: archive
---

# Axi 体育管理应用（已归档）

> 2026-09-17 归档。归档状态的权威源：[`ARCHIVE.md`](/Volumes/code/workspace/archive/axi-sports-management-app/ARCHIVE.md)。
> 章节：archive / 分区：`archive/`。

## 概要

Axi Sports Management App（`axi-sports-app`，`productName: "Axi Sports"`）原本是一个 `Quasar 2` + `Vue 3` + `TypeScript` 的多端骨架，目标场景是体育场馆 / 课程 / 会员管理。Web SPA 是主要产品形态，Capacitor Android shell 包裹同一份 bundle，后端是占位。它附带了完整的根目录文档套件（PRD、TDD、TODO、MILESTONE、CHANGELOG、INDEX、AGENTS、project-docs manifest），但零业务逻辑——`ExampleComponent.vue`（一个 todo counter）是唯一有意义的组件，`backend/`、`src-capacitor/android/app/`、`frontend/public/` 都是空或近乎空。

对 Axi 来说，这是一个**失败模式参照**，不是代码或产品参照。它给 Axi 留下的教训是：(1) 没有 MVP 楔子的"文档先行"脚手架会产生"文档-代码错配"——README、PRD、TDD、AGENTS 都承诺了一个体育场馆管理产品，但代码只是裸 Quasar 骨架，因此文档描述了一个并不存在的产品；(2) "skeleton" 阶段 + "private" + "0.0.1" 作为引导态是合理的，但必须在有限窗口内推进到 MVP，否则必须归档——这个仓库把 `0.0.1` 维持了 1.5 年，于 2026-09-17 归档且从未交付任何特性；(4) `docs/state/` 切分（PRD、TDD、TODO、MILESTONE、CHANGELOG 放在子目录，根目录只放 `INDEX.md` 和 `AGENTS.md`）是面向未来的 Quasar/Vue/Capacitor 项目可复用的模板，但前提是背后要有真正的代码；(5) `docs/project-docs.manifest.json` v2 清单即便对已归档项目也是可用的机器可读契约，是它让 2026-09-25 的审计通过；(7) 这里选定的 Quasar + Capacitor + Pinia + Vue I18n + `vue-i18n` + `@intlify/unplugin-vue-i18n` + flat-ESLint 技术栈在 Axi 真正想要复活时仍然是合理起点（`quasar.config.ts` 与 `eslint.config.js` 中捕获的版本与配置并未过时）。

**阶段**：已归档。**生命周期**：`docs/project-docs.manifest.json` 仍是 skeleton-active（2026-09-25 末次校验），但 `ARCHIVE.md` 自 2026-09-17 起以归档覆盖之。**权威路径**：`/Volumes/code/workspace/archive/axi-sports-management-app`。**分支策略**：工作分支为 `dev`，与 `origin/dev` 同步；最近本地提交 `4e05816 ci(workspace): use private governance remote`；工作树干净，仅有 2 个未跟踪的 submit-log 文件（`docs/logs/submit/20260928-121723-auto-submit.md`、`docs/logs/submit/20260930-082807-auto-submit.md`）。

## Stack

`Quasar 2`, `@quasar/app-vite ^2.1.0`, `TypeScript ~5.4.5`, `Vue 3 ^3.4.18`, `Pinia ^3.0.1`, `Vue Router ^4.0.12`, `Vue I18n ^11.0.0`, `@intlify/unplugin-vue-i18n ^4.0.0`, `axios ^1.19.0`, `@quasar/extras ^1.16.4`, `@capacitor/core ^7.0.0`, `@capacitor/android ^7.0.0`, `Vite 5`, `ESLint ^9.14.0`, `Prettier ^3.3.3`, `Vitest ^2.1.9`, `happy-dom ^20.14.5`, `@vue/test-utils`, `vue-tsc ^2.0.29`, `Node >=22.10.0`, `pnpm@10.33.2`

## Milestone Status

| 里程碑 | 状态 | 证据 |
| --- | --- | --- |
| M1 — Quasar 2 + Vue 3 + TypeScript 脚手架 | 已交付 | `package.json`（`name: axi-sports-app`、`version: 0.0.1`、`productName: Axi Sports`）；`src/App.vue`（`<router-view />`） |
| M2 — Pinia 仓库 + SPA 路由 + i18n 引导 | 已交付 | `src/stores/{index.ts, example-store.ts}`（`useCounterStore` 支持 HMR）；`src/router/{index.ts, routes.ts}`（`/` + `/:catchAll(.*)*`）；`src/boot/i18n.ts`（`createI18n`、`MessageLanguages`、`MessageSchema`、`legacy: false`） |
| M3 — en-US + zh-CN i18n 注册 | 已交付 | `src/i18n/index.ts`（7 LOC）+ `src/i18n/en-US/index.ts` + `src/i18n/zh-CN/index.ts` |
| M4 — axios 引导模块 | 已交付 | `src/boot/axios.ts`（Quasar 默认） |
| M5 — Vitest + happy-dom 测试脚手架 | 已交付 | `vitest.config.mts`；`pnpm test` 在零 spec 下返回 0 |
| M6 — Capacitor Android shell + 自定义 Cordova 插件 | 已交付 | `src-capacitor/package.json`（`@capacitor/{core,android,app,haptics,keyboard,splash-screen,status-bar}@^7.0.0`）；`src-capacitor/android/` 由 Android Studio 工程生成 |
| M7 — ESLint flat config（Quasar 推荐 + Vue + TS + Prettier skip） | 已交付 | `eslint.config.js`；ESLint `^9.14.0` |
| M8 — 完整根目录文档套件 | 已交付 | `README.md` + `README.zh-CN.md` + `AGENTS.md` + `INDEX.md` + `CHANGE.md` + `CHANGELOG.md`（占位）+ `TODO.md` + `MILESTONE.md` + `PRD.md` + `TDD.md` + `SECURITY.md` + `VERIFICATION.md` |
| M9 — `docs/state/` 切分 + project-docs v2 清单 | 已交付 | `docs/state/{PRD,TDD,CHANGELOG,MILESTONE,TODO}.md`；`docs/project-docs.manifest.json` v2（`status: verified`、`lifecycle: skeleton-active`） |
| M10 — 体育场馆 / 课程 / 会员管理特性 | **未交付** | 仅存在 `ExampleComponent.vue`（todo counter，37 LOC）；`backend/` 为空；`src-capacitor/android/app/` 仅含生成的 Capacitor 模板 |
| M11 — 项目准入流程重新审视 | **未交付** | `ARCHIVE.md` 记录了 1.5 年的不活跃；归档通知明确建议通过 `workspace-project route-intent` 重新准入，而不是原地复活 |
| M12 — 归档决定 | **已交付** | `ARCHIVE.md`（54 LOC）—— 2026-09-17：零业务逻辑 + 后端为空 + 文档-代码错配 + 1.5 年不活跃 |

## Build & Install（保留以备复活）

```bash
cd /Volumes/code/workspace/archive/axi-sports-management-app
pnpm install            # pnpm@10.33.2；engines: node>=22
pnpm dev                # quasar dev（默认端口 9000，**不是** 5173）
pnpm build              # quasar build
pnpm lint               # eslint -c ./eslint.config.js "./src*/**/*.{ts,js,cjs,mjs,vue}"
pnpm format             # prettier --write ...
pnpm test               # vitest run（占位；暂无 spec）
pnpm exec vue-tsc --noEmit   # 可选类型检查

# Capacitor Android shell（需要 Android SDK + 工具链）
cd src-capacitor && pnpm install
# 然后：npx cap sync android ; npx cap open android
```

`docs/HANDOFF.md` 中的健康检查命令为 `curl -fsS http://127.0.0.1:9000/`（Quasar dev server 默认端口，非 Vite 的 5173）；`pnpm dev` 会按 `quasar.config.ts#devServer.open: true` 自动打开浏览器。

## Architecture Highlights（或者说几乎没有）

**这个项目是什么。** 一个 Quasar 2 + Vue 3 + TypeScript SPA 脚手架，配 Pinia、Vue Router、Vue I18n（en-US + zh-CN 语言目录，但 `zh-CN` 与实际 `en-US` 默认值一同登记，仅注册一个几乎空的桩）以及 Capacitor 7 Android wrapper。`src/boot/` 中的引导模块是 `i18n.ts`（33 行：`createI18n`、`MessageLanguages`、`MessageSchema`、`app.use(i18)`）和 `axios.ts`（Quasar 默认）。路由器只配两条路由——`/` 与 `/:catchAll(.*)*`——在 `src/router/routes.ts` 中注册。Pinia 只有单个 `useCounterStore`（`src/stores/example-store.ts`，21 行），通过 `acceptHMRUpdate` 支持 HMR。唯一"特性"组件 `src/components/ExampleComponent.vue`（37 行）是一个 todo counter，演示了 `<script setup lang="ts">` + `defineProps` + `withDefaults` + `ref` + `computed`。没有 API client、没有鉴权、没有领域模型、没有路由守卫、没有测试。

**这个项目不是。** 它不是体育场馆 / 课程 / 会员管理应用。PRD 中提到的四个人物（场馆运营者、教练、会员、管理员）从未被实现。`backend/` 目录里没有 Go / Node / Python 代码；`src-capacitor/android/app/` 仅含 Capacitor 生成的 shell；`frontend/public/` 为空。`package.json` 中的 `pnpm test` 是占位。根 CHANGELOG 是桩（"暂无新增条目；由项目 owner 在每次提交后补充"）。这就是教科书般的"文档-代码错配"：文档描述了一个并不存在的产品。

**`docs/state/` 切分是最值得抢救的模式。** 把 PRD / TDD / TODO / MILESTONE / CHANGELOG 放进 `docs/state/` 子目录、而不是项目根，使根目录留给面向人的叙述（README、AGENTS、INDEX、CHANGE.md），状态目录留给机器校验的需求可追溯性。PRD 中的 REQ id（`REQ-SPORTS-P0-001`、`REQ-SPORTS-P0-002`、`REQ-SPORTS-P1-001` 等）被 TODO 和 CHANGELOG 引用，并由 `TDD.md` 中的文档完整性循环校验。这个模式对任何未来的 Quasar/Vue 项目都可复用，但前提是背后要有真正的代码。

**`project-docs.manifest.json` v2 schema 即使对归档项目也是正确的机器可读契约。** 此处的 `docs/project-docs.manifest.json` 是 v2 工作区清单的范例：它声明 `kind: quasar-vue-capacitor-application`、`lifecycle: skeleton-active`、`contracts.provides`、`contracts.consumes`、`environment.runtimes`、`currentWork.knownFailures`、`troubleshooting[]` 项、`verification.evidence[]` 字符串以及 `startup_profile` 块。即使人类可见的归档通知发布后，这份清单仍然让项目在 2026-09-25 可被审计。未来的项目应让清单与现实同步，而不是在 README 中过度承诺。

**分支策略与 CI/CD 钩子已经接入，但并未产生真正信号。** `docs/logs/submit/` 下有 11 份 auto-submit 与 grouped-commit 日志（2026-09-21 → 2026-09-30），大部分由工作区治理自动化生成。并没有真正构建或测试这个项目的 CI/CD——清单的 `verification.evidence` 项是一次性运维执行的产物，而不是重复运行的流水线。教训是：一个项目若其"证据"只来自人工运行的 shell 命令，则会因运维缺位而变成不可校验的，"verified: 2026-09-25"且无持续检查正是触发归档的失败原因。

**为何归档，按 `ARCHIVE.md` 原话。** 四点理由按序：(1) 零业务逻辑——完全没有体育管理特性；(2) 后端为空——`backend/` 从未落地任何实现；(3) 文档-代码错配——文档声称是"体育管理应用"但代码只是裸骨架；(4) 1.5 年无活动——自初始脚手架以来没有任何有意义的特性开发。`ARCHIVE.md` 对复活也给出了明确指引：走一次全新的 `workspace-project route-intent` 准入，先实现 MVP 体育管理特性，再写文档，并保持文档精简且与代码同步。当前分支是 `dev`，预期不再有合并。

## 说明

- **状态：已归档**（2026-09-17 归档；`ARCHIVE.md` 是权威通知；`docs/project-docs.manifest.json` 的 `lastVerifiedAt` 2026-09-25 在归档通知权威化之前仍显示 "verified"）。
- 骨架技术栈：`Quasar 2`（`@quasar/app-vite ^2.1.0`）+ `TypeScript ~5.4.5` + `Vue 3 ^3.4.18` + `Pinia ^3.0.1` + `Vue Router ^4.0.12` + `Vue I18n ^11.0.0` + `@intlify/unplugin-vue-i18n ^4.0.0` + `axios ^1.19.0` + `@quasar/extras ^1.16.4` + `@capacitor/core ^7.0.0` + `@capacitor/android ^7.0.0` + `Vite 5` + `ESLint ^9.14.0` + `Prettier ^3.3.3` + `Vitest ^2.1.9` + `happy-dom ^20.14.5` + `@vue/test-utils` + `vue-tsc ^2.0.29`；`engines: node>=22`，`packageManager: pnpm@10.33.2`。
- 唯一"特性"组件：`src/components/ExampleComponent.vue`（37 LOC 的 todo counter，演示 `<script setup lang="ts">` + `defineProps` + `withDefaults` + `ref` + `computed`）。
- Pinia：单个 `useCounterStore`（`src/stores/example-store.ts`，21 LOC）通过 `acceptHMRUpdate` 支持 HMR；没有 API client、没有鉴权、没有领域模型、没有路由守卫。
- Vue I18n：`src/boot/i18n.ts`（33 LOC：`createI18n`、`MessageLanguages`、`MessageSchema`、`legacy: false`、`app.use(i18n)`）；语言目录 `src/i18n/en-US/index.ts` + `src/i18n/zh-CN/index.ts`（`zh-CN` 与实际 `en-US` 默认值一同登记，仅注册一个几乎空的桩）。
- 路由器：两条路由 `/` 与 `/:catchAll(.*)*` 在 `src/router/routes.ts`（18 LOC）中注册；无守卫。
- Quasar dev server 默认端口 9000，非 5173（`quasar.config.ts#devServer.open: true` 自动打开浏览器）。
- `vitest.config.mts` 是占位；`pnpm test` 在零 spec 下返回 0。
- ESLint flat config（`eslint.config.js`）：Quasar 推荐 + Vue + TS + Prettier skip；ESLint `^9.14.0`。
- `docs/state/` 切分：`docs/state/{PRD,TDD,CHANGELOG,MILESTONE,TODO}.md`；PRD 使用 REQ id `REQ-SPORTS-P0-001` / `REQ-SPORTS-P0-002` / `REQ-SPORTS-P1-001` 等；TODO 与 CHANGELOG 交叉引用 REQ id；`TDD.md` 跑文档存在性循环。
- `docs/project-docs.manifest.json` v2：`kind: quasar-vue-capacitor-application`、`lifecycle: skeleton-active`、`status: verified`、`lastVerifiedAt: 2026-09-25`（仅校验过一次，未重复执行）。
- `backend/` 为空（无 Go / Node / Python 代码）；`src-capacitor/android/app/` 仅含生成的 Capacitor 模板；`frontend/public/` 为空。
- `docs/logs/submit/` 下有 11 份 auto-submit + grouped-commit 日志（2026-09-21 → 2026-09-30），由工作区治理自动化生成；并没有真正构建或测试这个项目的 CI/CD。
- 根 `CHANGELOG.md` 是桩（"暂无新增条目；由项目 owner 在每次提交后补充"）；`CHANGE.md`（8 LOC）指向 `docs/state/CHANGELOG.md`（不要手编辑）。
- 分支策略：工作分支 `dev`，与 `origin/dev` 同步；最近本地提交 `4e05816 ci(workspace): use private governance remote`；工作树干净，仅有 2 个未跟踪的 submit-log 文件（`docs/logs/submit/20260928-121723-auto-submit.md`、`docs/logs/submit/20260930-082807-auto-submit.md`）。

## Cross-References

- 工作区入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Axi Sports Management App (Archived)"。
- 项目根目录：`/Volumes/code/workspace/archive/axi-sports-management-app`
- 项目 `ARCHIVE.md`：`/Volumes/code/workspace/archive/axi-sports-management-app/ARCHIVE.md`（权威归档通知）
- 项目 `AGENTS.md`：`/Volumes/code/workspace/archive/axi-sports-management-app/AGENTS.md`
- 项目 `README.md`：`/Volumes/code/workspace/archive/axi-sports-management-app/README.md`
- 工作区注册项：`/Volumes/code/workspace/foundation/workspace-governance/workspace.json` 中 `archive.axi-sports-management-app`
- 工作区图节点：`/Volumes/code/workspace/workspace.graph.json` → `.projects.axi-sports-management-app`（或 `.archive.axi-sports-management-app`）
- AGENTS.md 引用的 ADR：ADR-001 至 ADR-010（位于 `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`）
- 工作区治理审计跟踪：`/Volumes/code/workspace/foundation/workspace-governance/docs/audits/workspace-docs-completeness-audit-2026-06-18.md`
- 任何复活需要走的工作区准入门：`workspace-project route-intent --intent <intent> --domain <domain> --json`（`ARCHIVE.md` 明确建议重新准入而不是原地复活）
- 其它已归档项目：位于 `/Volumes/code/workspace/archive/`