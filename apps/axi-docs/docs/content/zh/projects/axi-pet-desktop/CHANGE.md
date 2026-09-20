---
id: axi-docs-zh-projects-axi-pet-desktop
title: Axi Pet Desktop
type: project
status: draft
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-07-22
graph-title: Axi Pet Desktop
graph-tags: [Projects, projects]
description: Independent Electron desktop monorepo extracted from axi-pet on 2026-06-18 (former apps/stage-tamagotchi). Owns the macOS-first desktop-pet app and a self-contained set of Stage/electron/contract packages. Namespace locked to @axi-pet-desktop/* (legacy @proj-airi/* packages migrated 2026-07-17). Remote publication pending owner sign-off (see remote_decision_pending). Lineage: fork of axi-pet, sharing the moeru-ai/airi upstream.
project:
  id: axi-pet-desktop
  partition: projects
  path: /Volumes/code/workspace/projects/axi-pet-desktop
  source-section: core
---

# Change Log

> Canonical log: [`docs/HANDOFF.md`](docs/HANDOFF.md)（§ 5 变更历史与未来变更记录集中地）。
>
> 本文件遵循 `axi-rules` AR-BOOTSTRAP-002.1 选项 1（root pointer file）。
> 详细变更条目请写入 `docs/HANDOFF.md` § 5，本文件仅保留指针 + 顶层里程碑摘要。

## 顶层里程碑
- **2026-07-17** — **Yuzaki PNG 衣橱真实分层合成**：形象 schema 升级到 v2，生产运行时与定制工作台共用固定身份底图、脸部补片和上衣/下装/袜类/鞋子四个独立图层；每槽位可单独选色、随机、保存预设并持久化。历史整套 PNG 保留为明确的 `outfit` 兼容模式，旧存档自动迁移到有效部件 ID。首包现有每槽位一个版型，后续可直接按同一契约增加部件资源。详见 `docs/specs/2026-07-17-layered-png-wardrobe/PRD.md`。
- **2026-07-17** — **NewMax SenseVoiceSmall 本地共享复用**：Axi Pet fast STT sidecar 直接只读加载 NewMax 已下载的 INT8 ONNX 模型，不复制、不重复下载；模型不可用时保持 Paraformer、faster-whisper、Apple Speech 完整回退。补充静音/纯标点拒绝、共享模型发现测试与 setup 下载短路；安装版健康检查已确认实际运行 `sherpa-onnx-sensevoice / newmax-shared`。详见 `docs/HANDOFF.md` § 1。
- **2026-07-15** — **Yuzaki 身份资格门控修复**：撤销未认证 VRM 原型的生产默认资格；运行时不再在 `pet.model` 为空时自动注入该模型，桌宠与形象定制恢复使用已审核的由崎司 PNG 造型。形象工作台同步移除“旧衣橱/兼容兜底”误导文案，并接通 PNG 表情实时预览；原型模型仅保留为开发资源，正式 VRM / Live2D 必须通过身份与渲染审计后才能进入生产路径。
- **2026-07-15** — **人物区拖拽与右键菜单兼容恢复**：实时人物舞台保持普通 Web 交互区，右键通过显式 `pet:showContextMenu` 通道打开菜单；左键按住人物则通过 renderer → preload → main 手动拖窗通道，按全局光标增量移动窗口，不再依赖会吞掉右键的原生 drag region。顶部原生拖拽条继续保留，窗口位置持久化增加防抖。
- **2026-07-15** — **AppearanceSchema 与 VRM 编辑器第一阶段**：形象定制改为左侧编辑器、右侧生产 `ThreeScene` 的同源实时预览；新增渲染器无关 schema、草稿撤销/重做/随机/预设、`pet:setAppearance` 持久化，并验证 VRM 原型具备 14 类表情、56 个 Morph Target 与材质编辑能力。该原型随后经身份复核判定不符合由崎司生产规范，默认路由与 PNG 定位已由同日身份门控修复纠正。详见 `docs/specs/2026-07-15-appearance-studio/PRD.md`。
- **2026-07-15** — **MiniMax 唤醒门控**：桌宠启动、空闲台词与首次短句库初始化全部只走本地路径；只有本地 `yuzaki` 唤醒被接受后才执行一次 MiniMax TTS 健康检查，唤醒提示保留本地字幕、不再合成“嗯，我在听”。唤醒轮结束即回落本地 TTS，杜绝一分钟后台探测消耗额度。详见 `docs/HANDOFF.md` § 1。
- **2026-07-15** — **单运行时迁移完成**：退役历史 Vue 应用、页面/布局/旧渲染器、专属场景工具与 Godot 实验；活跃依赖图只保留 `desktop-pet` React 运行时。`stage-ui-live2d`、`stage-shared`、`electron-screen-capture` 与 `audio` 同步去除兼容层及 Vue 栈声明。详见 `docs/specs/2026-07-15-single-runtime-migration/PRD.md`。
- **2026-07-13** — **TTS 专有姓名读音语料化**：显示台词继续保留“由崎星空”，隐藏 TTS 输入通过独立 `tts-pronunciation-corpus.json` 转为官方日文读音“ユザキナサ”；普通“星空”不改写，修复前的错误缓存音频不再复用。详见 `docs/HANDOFF.md` § 1。
- **2026-07-13** — **对话固定问答语料化**：删除 `persona-fact` 宽泛正则与代码内固定答复，固定常见问题只允许 `common-question-corpus.json` 整句精确命中；限定对象和开放追问统一进入 MiniMax。模型/解析/TTS 失败不再回放模糊历史语料或替换成“嗯，我在听”，从源头消除答非所问和字幕/语音错位。详见 `docs/HANDOFF.md` § 1 与 `docs/ARCHITECTURE.md` 对话路由约束。
- **2026-06-30** — **PLAN.md 阶段 C 全部完成（`stage-ui-live2d` React 19 / Zustand 迁移，~24 commit）**：让活跃 `apps/desktop-pet` 通过 `stage-ui-live2d` 完全不再间接拉 Vue / Pinia / @vueuse/core 任何运行时代码。C0 完成 `vue` / `pinia` / `@vueuse/core` 从 `dependencies` 移到 **optional peerDependencies**（`9bcb81a`）+ 标记 `Live2DWardrobeScene` 切点（`415c1ac`）+ 新建 `stores/zustand/` 类型骨架（`00be135`）；C1 把 4 个 Pinia store（`view-control` / `model-parameters` / `expression-store` / `settings`）逐个迁移到 Zustand + `subscribeWithSelector`（`b38d4b7` / `a04287e` / `7a30c67` / `35b7f40`），提取 `live2d.ts` 的 11 个 `useLocalStorageManualReset` 为纯配置对象后改用 zustand singleton（`10a6cb7` / `3305949`），barrel exports 调整为新旧并存（`129c7f9`），补 Zustand store 测试（`b6b24f7`）；C2 把 8 个 Vue composable 改写为 React 19 hook 或 framework-agnostic 纯函数（`eye-tracking` / `motion-manager` / `beat-sync` / `fit-model` / `expression-controller` 类型 `Ref<T>` → `MutableRef<T>`，`use-eye-tracking` / `use-motion-manager` / `use-beat-sync` / `use-fit-model` 新文件）；C3 重写 `Model.tsx` + `Live2DScene.tsx` + `Model.vue` 移除所有 vue 运行时引用（移除 `storeToRefs` / `watchEffect` / `vueRef` / `until` from `@vueuse/core` / 17 个 useEffect 参数同步 → 1 个循环 + `PARAMETER_TO_CUBISM_ID` 映射表）；C4 完成 barrel 调整 + `Live2DWardrobeScene.tsx` 静态 import 切换 + 文档同步。**已确认**：`stage-ui-live2d` 源文件 `grep "from 'vue'"` 仅剩 `Live2D.vue` / 旧 `eye-tracking.ts` / 旧 `beat-sync.ts` / 旧 `fit-model.ts` 文件级 import（无 .tsx 引用）；`pnpm -F @axi-pet-desktop/desktop-pet rebuild:mac` 的 electron-builder 依赖列表中 `vue` 与 `@vueuse/core` **完全消失**（仅 `@vueuse/shared` 来自 `reka-ui` 间接）。desktop-pet typecheck + 389/390 测试通过。`docs/HANDOFF.md` § 5.8 + `docs/specs/2026-06-29-stage-ui-live2d-react-migration/` 三件套同步。

- **2026-06-29** — **PLAN.md 阶段 A+B 框架 Vue 清理**：`packages/ui` 完全清掉 .vue / vue 运行时（39 个 .vue 删除，package.json 移除 `vue` / `@vueuse/core` / `floating-vue` / `vue-tsc`，typecheck 切换为 `tsc`）；`packages/stage-shared` 将 `vue` / `@vueuse/core` / `pinia` 从 dependencies 移到 **optional peerDependencies**，3 个 Vue composables 保留供 stage-ui-live2d / stage-tamagotchi 过渡期使用。desktop-pet typecheck + test:run (389 passed) 全过。desktop-pet 运行时仍通过 `stage-ui-live2d`（dependencies）间接拉 vue，**Phase C（stage-ui-live2d React/Zustand 迁移）待续**。详见 `docs/HANDOFF.md` §1 与 commits `d7e7606` / `754ad77`。

- **2026-06-24 ~ 2026-06-26** — **桌面宠物 React 迁移主线（M0-M3.7）**：desktop-pet 切换到 React 19 + React Three Fiber（VRM/Three 渲染）+ Zustand 状态管理；新建 `@axi-pet-desktop/desktop-pet-renderer` 包；stage-ui / ui 大量提供 React adapters + wrappers（components、scenarios、providers、stores、workers 等）；引入 Radix UI + cmdk + framer-motion；stage-ui-three 标记 deprecated。期间同步完成 wardrobe 修复（alpha 归一、窗口拖拽、remediation verdict）与 canonical review 窗口加载/播放/卡片问题修复。2026-06-26 额外隔离 10 张身份不一致的 nijigen 二创（归档 + catalog reject 状态 + 新增 SOP 与 prompt 模板）。全部变更经 `pnpm -F @axi-pet-desktop/desktop-pet test:run`（389 passed）+ `rebuild:mac` + 安装验证。详见 `docs/HANDOFF.md` §1 及 M* 系列提交。

- **2026-06-25** — HANDOFF.md 所有问题解决计划完成：P0/P1 待办关闭、CI bootstrap（.github/workflows/ci-desktop-pet.yml）、pet-runtime-bootstrap-refactor spec + 初始实施（PetRuntimeDeps + bootstrap，ctor 减为分组）。详见 plan.md 及新 spec 目录。变更后 desktop-pet typecheck/tests/build 通过。

- **2026-06-18** — 仓库从 `axi-pet` 完整剥离（`apps/stage-tamagotchi` + 桌面专用包 + Godot 集成）。详见 `SEPARATION.md` 与 `axi-pet/docs/SEPARATION-desktop.md`。
- **2026-06-19** — 根级 `AGENTS.md` / `docs/HANDOFF.md` / 根级 `CHANGE.md` 落盘；`infra/axi-workspace-governance/workspace.json` 补登 `axi-pet-desktop` 条目；根 `package.json` 暴露 `@axi-pet-desktop/desktop-pet` 入口；`README.md` 增补 `desktop-pet` 段落。详见 [`docs/HANDOFF.md`](docs/HANDOFF.md) § 5.1。
- **2026-06-22** — `desktop-pet` main 进程三阶段拆分重构：① `voice-session.ts` / `appearance-runtime.ts` 移除 `as any` 与硬编码常量；② `resolveVoiceCandidateText` / `resolveFastAppleText` 抽到 `runtime-transcript-utils.ts` 为纯函数并补 19 个单测；③ `index.ts` 由 748 行拆为 353 行装配根 + 6 个职责单一模块（`window-manager` / `context-menu` / `ipc-handlers` / `deep-link-router` / `protocol-handler` / `send-to-renderer`）。335 测试全过、`rebuild:mac` exit 0、应用重新安装并受 LaunchAgent 管理。完整 lifecycle spec（PRD / DESIGN / TASK）见 [`docs/specs/2026-06-22-desktop-pet-main-runtime-split/`](docs/specs/2026-06-22-desktop-pet-main-runtime-split/)，摘要见 [`docs/HANDOFF.md`](docs/HANDOFF.md) § 5.4。
- **2026-06-23** — 台词复审 UI：右键菜单"台词复审"项 + 独立 BrowserWindow + 列表展示 `verifiedBy !== 'human'` 的候选台词（frame + 播放 + 合格/错误 + 可编辑中文字幕）。新模块 `canonical-line-review-service.ts`（listPending / approve / reject，原子写 manifest），新 IPC 4 个（`listCanonicalLineReviewEntries` / `approveCanonicalLine` / `rejectCanonicalLine` / `openCanonicalLineReview`），新 Vue 组件 `CanonicalLineReview.vue`。附带修复 `App.test.ts` caption 在 error 状态不显示的 baseline bug（加 placeholder reply）与 `OutfitGridAudit.test.ts` mock 名称不匹配生产 API + 测试间状态污染的 baseline（mock 改名 `getWardrobeVerdicts` 等，`beforeEach` 改为无脑重置）。370 测试全过、`rebuild:mac` exit 0。完整 lifecycle spec（PRD / DESIGN / TASK）见 [`docs/specs/2026-06-23-canonical-line-review-window/`](docs/specs/2026-06-23-canonical-line-review-window/)，摘要见 [`docs/HANDOFF.md`](docs/HANDOFF.md) § 5.5。
- **2026-06-24** — Canonical 台词 TTS 主线修正：原片音频改为 `reviewAudioFile` 复审证据，运行时 canonical reply 不再携带原片 `audioHandle`，而是用 `spokenJa` 走当前 MiniMax 克隆女主音色 TTS；复审窗口主试听也改为克隆音色 TTS，原片按钮只作证据对照；`dialogue:extract --speaker-profile` 改为跳过未匹配目标声纹的文本候选。完整 lifecycle spec 见 [`docs/specs/2026-06-24-canonical-line-tts-pipeline/`](docs/specs/2026-06-24-canonical-line-tts-pipeline/)，摘要见 [`docs/HANDOFF.md`](docs/HANDOFF.md) § 5.7。

## 引用规约

- 行为 / workflow / 验证 / 用户可见 / 回滚相关变更 → 写 `docs/HANDOFF.md` § 5.2 / 5.3，并在本文件追加一行顶层里程碑。
- 完整 diff 写 `docs/specs/<change-id>/`，不要直接堆在 `CHANGE.md`。

---

**最后更新**：2026-07-17 — Yuzaki PNG 形象定制升级为四槽位真实分层组合，整套 PNG 降为兼容模式。详细历史见 `docs/HANDOFF.md`。
