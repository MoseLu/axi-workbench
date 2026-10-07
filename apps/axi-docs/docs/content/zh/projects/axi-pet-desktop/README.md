---
id: axi-docs-zh-projects-axi-pet-desktop
title: Axi Pet Desktop
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Pet Desktop
graph-tags: [Projects, workbench]
tags: [Axi Docs, 项目, workbench, desktop, electron, react, R3F, VRM]
description: 从 axi-pet 拆出的独立 macOS 优先 Electron + React 19 + R3F VRM 桌面宠物 monorepo。活跃面是 @axi-pet-desktop/desktop-pet；历史上的 stage-tamagotchi Vue 3 锚点仅作为回退保留。
project:
  id: axi-pet-desktop
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-pet-desktop
  source-section: core
---

# Axi Pet Desktop

> 项目根 `AGENTS.md` + `CLAUDE.md` + `README.md` + `docs/ARCHITECTURE.md` + `docs/HANDOFF.md` 的镜像；项目根为唯一权威。
> Source of truth:
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/AGENTS.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/AGENTS.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/CLAUDE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CLAUDE.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/README.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/README.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/docs/ARCHITECTURE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/ARCHITECTURE.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/docs/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/HANDOFF.md).
> Section: core / Partition: `workbench/`。

## 概述

Axi Pet Desktop 是 macOS 优先的轻量 VRM 桌面宠物 Electron + React 19 monorepo，已完全从上游 `axi-pet` monorepo 拆出。本仓于 2026-06-18 剥离并以 `@axi-pet-desktop/*` 命名空间独立维护。共存两个 Electron 入口 app：`apps/desktop-pet`（`@axi-pet-desktop/desktop-pet`，React 19 + React Three Fiber + Zustand + Radix UI）是当前唯一活跃可运行 runtime；`apps/stage-tamagotchi`（Vue 3）作为历史迁移锚点保留，配套显式的 `*:tamagotchi` 根脚本变体。单一 runtime 迁移（Phase A + B + C0–C4）于 2026-06-29 完成：Vue / Pinia / @vueuse/core 在 `packages/stage-shared` 与 `packages/stage-ui-live2d` 中被降级为 optional peerDeps，四个 Pinia store 迁移到 Zustand，`packages/ui` 成为纯 React 19（不含 vue runtime）。Electron 主进程永不跨 IPC 边界传递 API key；MiniMax 是唯一的 chat + speech 云端 provider；本地 wake/STT 是 openWakeWord acoustic KWS 加上 owner verifier 和 faster-whisper sidecar fallback chain。

桌面 renderer 用 `packages/desktop-pet-renderer` 替换了已废弃的 `packages/stage-ui-three`，提供三层结构（`./runtime` 中的框架无关 three.js + pixiv-vrm primitives、`./react` 中的 React 19 + R3F 组件、`./stores` 中的 Zustand store）。历史上的 `apps/stage-tamagotchi` 物理工作树已于 2026-08-11 按 `docs/specs/2026-08-11-single-runtime-physical-removal/PRD.md` `rm -rf`；仅留下 git history。配套的 `engines/stage-tamagotchi-godot/` Godot 4.6 集成（C#、Jolt Physics、MToon + VRM addons）也已从 `axi-pet` 迁入本仓，挂在自己独立的 `project.godot` 与 `.sln` 下。两个 Hatsune Miku 资产（注册入口 + 一张已审计的 2000×3000 中性底图）于 2026-09-14 上线；voice / wake / Tailunorid 音频资产仍在按资产审计。

**当前阶段**：活跃 monorepo，单一 runtime（React 19）。
**规范路径**：`/Volumes/code/workspace/workbench/axi-pet-desktop`。
**分支**：`agent/audit-fix-a02-pet-desktop-lockfile`（除两个新 submit log 外工作树干净）。
**最新已安装 `app.asar` SHA-256**：`91b62390971a7d9822600d82b7ee396c2d461855385421cb2abcfaf6f569058c`（2026-08-11）。
**最新证据时间戳**：`2026-09-25`（`docs/HANDOFF.md`）。

## 技术栈

| Surface | Tech | Notes |
| --- | --- | --- |
| Active Electron app `apps/desktop-pet` | Electron + electron-vite + UnoCSS | Main (`src/main`), preload (`src/preload`), renderer (`src/renderer`), shared types (`src/shared`), core (`src/core`). `externalizeDeps.exclude` keeps `@axi-pet-desktop/desktop-pet-renderer` bundled. |
| Renderer UI | React 19 + Radix UI + cmdk + Framer Motion + UnoCSS | Renderer is intentionally limited to the pet, captions, transient input, and small status affordances. |
| VRM runtime | `@axi-pet-desktop/desktop-pet-renderer` (R3F + pixiv-vrm + pixiv/three-vrm-animation + pixiv/three-vrm-core + Zustand) | Three-layer: `runtime/` framework-agnostic, `react/` R3F components, `stores/` Zustand. `@moeru/eventa` for trace primitives. Replaces deprecated `packages/stage-ui-three`. |
| Stage UI packages | `packages/ui` (React 19 only), `packages/stage-ui-live2d` (Vue → optional peerDeps + Zustand), `packages/stage-ui-spine`, `packages/stage-ui-three` (deprecated for desktop-pet), `packages/stage-shared` (vue → optional peerDeps) | Single-runtime migration (Phase A + B + C0–C4) completed 2026-06-29. |
| Electron bridges | `packages/electron-eventa`, `packages/electron-screen-capture`, `packages/electron-vueuse` | Electron-specific; consumed only by desktop apps. |
| Plugins / scenarios | `packages/plugin-protocol`, `packages/plugin-sdk`, `packages/plugin-sdk-tamagotchi`, `packages/scenarios-stage-tamagotchi-electron`, `packages/vishot-runner-electron` | Tamagotchi-anchored surface; 0.x SemVer-locked cross-end contracts. |
| Core runtime | `packages/core-agent`, `packages/core-character`, `packages/model-driver-lipsync`, `packages/pipelines-audio`, `packages/stream-kit` | Shared agent + character + audio pipeline contracts. |
| Cross-end contracts | `packages/server-runtime`, `packages/server-sdk`, `packages/server-sdk-shared`, `packages/server-shared` | Versions independently evolved since 2026-06-23. |
| Voice + STT + Wake | `openWakeWord` acoustic KWS + owner verifier + Apple Speech bridge (`AxiPetSpeechBridge`) + faster-whisper large-v3-turbo | Wake models live at `~/Library/Application Support/AxiPetDesktop/Wake/models/{yuzaki.onnx,yuzaki_verifier.pkl}`; STT models at `~/Library/Application Support/AxiPetDesktop/STT/models/faster-whisper-large-v3-turbo-ct2`; shared NewMax SenseVoiceSmall override `AIRI_SENSEVOICE_MODEL_PATH`. |
| Godot integration | `engines/stage-tamagotchi-godot` — Godot 4.6 + C# + Jolt Physics + `Godot-MToon-Shader` and `vrm` addons | Migration from `axi-pet` complete; package contract via `project.godot` and `stage-tamagotchi-godot.csproj`. |
| Provider | MiniMax (chat + speech only) | AGENTS forbids Ollama / Docker / local-model routing. |

## 项目结构

```text
axi-pet-desktop/
├── apps/
│   ├── desktop-pet/                    # @axi-pet-desktop/desktop-pet — ACTIVE
│   │   ├── AGENTS.md                   # voice / STT / wake / wake training / agent completion workflow
│   │   ├── electron.vite.config.ts
│   │   ├── playwright.config.ts
│   │   ├── package.json
│   │   ├── scripts/                   # rebuild-mac.mjs, speech-bridge build, STT/Wake setup, training, audit
│   │   ├── resources/                 # wake listener.py + icons
│   │   └── src/
│   │       ├── main/
│   │       │   ├── platform/          # config, context-menu, deep-link-router, ipc-handlers, launch-agent,
│   │       │   │                      # permission-policy, pet-runtime-bootstrap, pet-window-size,
│   │       │   │                      # protocol-handler, runtime-event, runtime-logger,
│   │       │   │                      # runtime-transcript-utils, send-to-renderer, window-drag,
│   │       │   │                      # window-manager, window-mouse-passthrough, concept-resource-path
│   │       │   ├── voice/             # local-stt, local-tts, local-wake, pet-voice-service, tts-orchestrator,
│   │       │   │                      # voice-session, voice-diagnostic, speaker-profile, speech-language,
│   │       │   │                      # stt-model-discovery, pet-runtime-constants
│   │       │   ├── chat/              # corpus-store, model-service, phrase-library, reply-parser, minimax,
│   │       │   │                      # token-resolver, memory-llm-extract, soul-runtime-store
│   │       │   ├── canonical-line/    # canonical-line-store, proactive-dialogue-service
│   │       │   ├── pet-runtime/       # pet-runtime-service (12-dep orchestrator)
│   │       │   ├── wardrobe/          # appearance-runtime, outfitSelector, triggerRules, outfits, outfit-catalog
│   │       │   ├── wake-training/     # wake-training-service
│   │       │   └── ipc __ipc__/, seed-daily-corpus.test.ts, speech-bridge-config.test.ts, index.ts
│   │       ├── preload/              # contextBridge surface (API key NOT crossed)
│   │       ├── renderer/             # App.tsx, AppearanceStudio, AppearanceWorkspaceSidebar, ExpressionSprite,
│   │       │                          # LayeredPngSprite, Live2DWardrobeScene, OutfitGridAudit, WakeTrainingGuide,
│   │       │                          # character-assets, expression-assets, voice-cues, wardrobe-audit, ui-state
│   │       ├── shared/               # types, error, characters, soul, outfits
│   │       └── core/                 # outfit-catalog, outfits, wardrobe (character selection + normalizers)
│   └── stage-tamagotchi/             # @axi-pet-desktop/stage-tamagotchi — HISTORICAL, Vue 3
│                                       # electron-builder.config.ts, electron.vite.config.ts, src/
├── packages/                          # 28 self-contained desktop Stage / bridge / runtime packages
│   ├── desktop-pet-renderer/         # R3F + pixiv-vrm (replaces stage-ui-three)
│   ├── stage-ui/                      # React 19 only (post Phase A 2026-06-29)
│   ├── stage-ui-live2d/               # Vue / Pinia / @vueuse/core → optional; 4 Pinia stores → Zustand
│   ├── stage-ui-spine/                # Spine runtime
│   ├── stage-ui-three/                # DEPRECATED for desktop-pet
│   ├── stage-shared/                  # vue → optional peerDeps (Phase B)
│   ├── stage-pages/                   # historical Vue page aggregation
│   ├── stage-layouts/                 # historical layout components
│   ├── ui/                            # pure React 19 component library
│   ├── i18n/                          # desktop-side i18n
│   ├── ui-transitions/                # transition primitives
│   ├── audio/  ccc/  font-chillroundm/  font-cjkfonts-allseto/  font-xiaolai/
│   ├── core-agent/  core-character/   # agent + character contracts
│   ├── model-driver-lipsync/          # lip-sync driver
│   ├── pipelines-audio/  provider-catalog/  stream-kit/
│   ├── plugin-protocol/  plugin-sdk/  plugin-sdk-tamagotchi/  scenarios-stage-tamagotchi-electron/
│   ├── vishot-runner-electron/        # desktop screenshot runner
│   ├── server-runtime/  server-sdk/  server-sdk-shared/  server-shared/   # cross-end contracts
│   └── electron-eventa/  electron-screen-capture/  electron-vueuse/
├── engines/
│   └── stage-tamagotchi-godot/       # Godot 4.6 + C# + Jolt + MToon / VRM addons
├── docs/
│   ├── ARCHITECTURE.md                # layered top-level structure, runtime boundary
│   ├── HANDOFF.md                     # zero-context takeover brief
│   ├── TESTING.md  VERIFICATION.md
│   ├── logs/  specs/  state/  superpowers/  testing/  project-docs.manifest.json
├── apm.yml                            # APM package manifest (shared runtime install)
├── apm.lock.yaml
├── AGENTS.md  CLAUDE.md  README.md  README.zh-CN.md
├── INDEX.md  SEPARATION.md  DESIGN.md  PLAN.md  PRD.md
├── TODO.md  CHANGE.md  CHANGELOG.md  MILESTONE.md
└── pnpm-workspace.yaml                # apps = apps/desktop-pet, apps/stage-tamagotchi, packages/*, engines/*
```

## 构建与安装

```bash
# Setup
pnpm install

# Develop — default desktop-pet (active)
pnpm dev                                 # alias: pnpm -F @axi-pet-desktop/desktop-pet run dev
pnpm dev:tamagotchi                      # historical stage-tamagotchi (Vue 3) only

# Type / lint / test
pnpm typecheck                          # covers both apps
pnpm lint
pnpm test                               # desktop-pet only (vitest)
pnpm -F @axi-pet-desktop/desktop-pet test:run
pnpm -F @axi-pet-desktop/desktop-pet coverage:check

# Build & package
pnpm rebuild:mac                        # test:run + build:mac (recommended desktop flow)
pnpm -F @axi-pet-desktop/desktop-pet build:mac
pnpm build:win                          # stage-tamagotchi
pnpm build:linux                        # stage-tamagotchi

# First-time macOS wake setup
pnpm -F @axi-pet-desktop/desktop-pet setup:wake
pnpm -F @axi-pet-desktop/desktop-pet record:wake-positive    # >= 3 recordings
pnpm -F @axi-pet-desktop/desktop-pet record:wake-negative    # >= 2 recordings
pnpm -F @axi-pet-desktop/desktop-pet train:wake-model
pnpm -F @axi-pet-desktop/desktop-pet rebuild:mac

# First-time macOS STT setup
pnpm -F @axi-pet-desktop/desktop-pet setup:stt

# Asset audit
pnpm -F @axi-pet-desktop/desktop-pet assets:audit-mukuro
pnpm -F @axi-pet-desktop/desktop-pet assets:audit-expression-matrix
pnpm -F @axi-pet-desktop/desktop-pet audit:all
```

对 `apps/desktop-pet/**` 任何触及 runtime / voice / STT / packaging / UI 的修改，**Agent completion workflow**（`apps/desktop-pet/AGENTS.md` § "Agent completion workflow"）要求：`rebuild:mac` → 停止正在运行的 `Axi Pet Desktop` / `AxiPetSpeechBridge` → 将 `apps/desktop-pet/dist/mac-arm64/Axi Pet Desktop.app` 拷贝到 `/Applications/` → 启动 → 恢复 `~/Library/LaunchAgents/com.mose.AxiPetDesktop.plist`。最新已安装 `app.asar` SHA-256 为 `91b62390971a7d9822600d82b7ee396c2d461855385421cb2abcfaf6f569058c`（2026-08-11）。

## 验证

```bash
# Minimum verification — desktop-pet-only change
pnpm -F @axi-pet-desktop/desktop-pet typecheck
pnpm -F @axi-pet-desktop/desktop-pet test:run            # 900 passed / 5 skipped (2026-09-14)
pnpm -F @axi-pet-desktop/desktop-pet lint
pnpm -F @axi-pet-desktop/desktop-pet assets:audit-mukuro
pnpm -F @axi-pet-desktop/desktop-pet assets:audit-expression-matrix
pnpm -F @axi-pet-desktop/desktop-pet rebuild:mac

# Stage-tamagotchi-only change
pnpm -F @axi-pet-desktop/stage-tamagotchi typecheck
pnpm -F @axi-pet-desktop/stage-tamagotchi test:run

# Cross-package contract change (plugin-protocol / server-sdk / stage-shared / core-agent)
pnpm -F @axi-pet-desktop/<name> typecheck
pnpm -F @axi-pet-desktop/desktop-pet test:run

# Workspace catalog / patches
pnpm install
pnpm dedupe:check

# End-to-end smoke (renderer)
pnpm -F @axi-pet-desktop/desktop-pet e2e:linux
```

## 架构要点

Axi Pet Desktop 组织为三层 monorepo：`apps/`、`packages/`、`engines/`。Electron 进程划分（main / preload / renderer）在 `apps/desktop-pet` 内部强制执行；renderer 刻意被压缩为只承载宠物、字幕、瞬时输入与少量状态指示，而所有 API-bearing 服务（MiniMax chat、TTS、STT、wake、owner-verifier、LaunchAgent、context menu、deep link、file watcher）都位于主进程。`apps/desktop-pet/src/main/index.ts` 是一个轻量 shim，导入 `./platform/index`，`electron.vite.config.ts` 将 `@axi-pet-desktop/desktop-pet-renderer` 排除在 `externalizeDeps` 之外，因此打包后的 Electron 不会让 Node 去执行 `node_modules` 中的 TypeScript 来加载 renderer bundle。

`PetRuntimeService` 是一个 12 依赖的跨 feature 编排器，位于 `apps/desktop-pet/src/main/pet-runtime/pet-runtime-service.ts`，对所有依赖显式标注类型（Config store、corpus store、LaunchAgent service、local STT、local wake、MiniMax client、model service、voice service、phrase library、proactive dialogue service、canonical line store、runtime event、soul runtime store、speaker profile、TTS orchestrator，外加 `AppearanceContext`、trigger rules、wardrobe selection、voice session state）。Voice session state 按引用传递（`VoiceSessionState`），因为耦合的 timer + flag + actor 面太大，显式穿透代价过高；`apps/desktop-pet/src/main/voice/voice-session.ts` 中的助手面保证契约显式（`voiceWakePersistent`、`voiceSessionActive`、`ownerVoiceAcceptedForSession`、`pendingFollowUpCommandCapture`、`conversationFollowUpUntil`、`activeTurnId`、`voiceSessionTimer`、`followUpCommandTimer`、`emptyCommandCaptureRetries`、`playbackActive`、`voiceState`、`acousticWakePrimary`、`paused`、`voiceService`、`localWake`）。Phase 4 split 将生命周期助手（`startVoiceSession` 等）从编排器中抽出，同时接受共享可变记录这一权衡。

VRM runtime 包 `@axi-pet-desktop/desktop-pet-renderer`（在 `packages/desktop-pet-renderer/package.json` 中声明了显式子路径导出：`.`、`./runtime/vrm`、`./runtime/vrm/utils`、`./runtime/appearance`、`./runtime/shader`、`./trace`、`./stores`、`./react`、`./assets/vrm`、`./assets/vrm/animations`）替换了已废弃的 `packages/stage-ui-three`。它的三层拆分 —— 框架无关的 `runtime/`（three.js / pixiv-vrm primitives）、`react/`（R3F 组件如 `<ThreeScene>` 与 `<VRMModel>`）、`stores/`（Zustand `useModelStore`）—— 让业务代码获得 React-first 的面，同时让 R3F 相关代码保持框架无关以便后续替换。`@moeru/eventa` 提供 trace primitives。

Single-runtime 迁移是 package 布局背后的承重决策。Phase A（2026-06-29）清除了 `packages/ui` 中的 `.vue` / vue runtime；Phase B 将 `vue` / `@vueuse/core` / `pinia` 在 `packages/stage-shared` 中降级为 optional peerDeps；Phase C0–C4 迁移了四个 Pinia store 到 Zustand，把八个 Vue composable 重写为 React 19 hook 或框架无关纯函数，清除了 `Model.tsx` / `Live2DScene.tsx` 中残留的 `watchEffect` / `storeToRefs`，并将 `desktop-pet Live2DWardrobeScene` 改为静态 import。`rebuild:mac` 的 electron-builder 依赖列表不再包含 `vue` / `@vueuse/core`（只剩 `reka-ui` 间接依赖的 `@vueuse/shared`）。2026-07-15 后历史 `apps/stage-tamagotchi` 的物理工作树被 `rm -rf`；2026-08-11 整个 `apps/stage-tamagotchi/` 目录被物理删除，`pnpm-workspace.yaml` 的 `apps/**` 收紧到 `apps/desktop-pet`（外加 `!**/out/**` 安全网）。

Voice / STT / Wake 边界是显式且规则化的。Wake 是位于 `resources/wake/listener.py` 的本地 openWakeWord acoustic KWS，用于罗马字 `yuzaki`，从 owner 录音训练并对差异化的本地语音做验证；可选 owner verifier 只是次级防护，AGENTS 禁止扩展同音别名列表（`尾崎`/`鱼仔` 等）。Apple Speech bridge `AxiPetSpeechBridge` 在等待 wake-word 唤醒期间**只能**监听 `en_US + ja_JP + zh_CN`；日语识别只是为了提升 wake recall。Wake 启动 session 后，同一 bridge 仅使用 `zh_CN` 进行命令捕获。Confirmation STT 优先使用共享 NewMax `SenseVoiceSmall`（`~/.newmax/models/sensevoice-small/{model.int8.onnx,tokens.txt}`）；可通过 `AIRI_SENSEVOICE_MODEL_PATH` 覆盖。Fallback chain 为 `shared SenseVoiceSmall → Axi Pet-managed Sherpa Paraformer → local faster-whisper → Apple transcript`。模型**绝不**是外部卷的 symlink —— 之所以允许 NewMax 复用，是因为它是本机内部磁盘的应用缓存。

Cross-end contracts（`plugin-protocol` / `server-sdk` / `stage-shared` / `core-agent`）是 0.x SemVer-locked，自 2026-06-23 起独立演进：仓库所有者钉死版本，消费方（如上游 `axi-pet`）不必跟随。Godot 引擎集成 `engines/stage-tamagotchi-godot` 也是本仓一部分：Godot 4.6 + C#、Jolt Physics、启用 `Godot-MToon-Shader` 与 `vrm` 编辑器插件，`run/main_scene = res://scenes/stage-root.tscn`，项目 assembly name 为 `stage-tamagotchi-godot`。桌面侧 `apps/desktop-pet/scripts/` 持有 canonical rebuild（`rebuild-mac.mjs`）、speech-bridge 构建（`build-speech-bridge.mjs`）、STT / wake venv 安装（`setup-local-stt-venv.mjs`、`setup-local-stt-model.mjs`、`setup-local-wake-venv.mjs`、`setup-wake-model.mjs`、`setup-mukuro-wake-model.mjs`）与资产审计脚本（`audit-mukuro-assets.ts`、`audit-miku-assets.ts`、`audit-expression-matrix.ts`、`audit-expression-bundle.ts`、`run-all-audits.mjs`）。

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| 从上游拆出 | 从 `axi-pet` 剥离成独立仓库 | 完成（2026-06-18） |
| 单一 runtime Phase A | 清除 `packages/ui` 中的 `.vue` / vue runtime | 完成（2026-06-29） |
| 单一 runtime Phase B | 将 `vue` / `@vueuse/core` / `pinia` 在 `packages/stage-shared` 中降级为 optional peerDeps | 完成（2026-06-29） |
| 单一 runtime Phase C0–C4 | 迁移 4 个 Pinia store 到 Zustand；将 8 个 Vue composable 重写为 React 19 hook / 框架无关纯函数；将 `desktop-pet Live2DWardrobeScene` 切换为静态 import | 完成（2026-06-29） |
| Stage-tamagotchi 工作树移除 | `rm -rf` 历史 `apps/stage-tamagotchi/`，`pnpm-workspace.yaml` `apps/**` 收紧到 `apps/desktop-pet` | 完成（2026-07-15 → 2026-08-11） |
| VRM runtime 包 | `packages/desktop-pet-renderer`（R3F + pixiv-vrm）替换已废弃的 `packages/stage-ui-three` | 完成 |
| Voice / STT / Wake 边界 | openWakeWord acoustic KWS + owner verifier + Apple Speech bridge + faster-whisper fallback chain | 完成 |
| Cross-end contracts | `plugin-protocol` / `server-sdk` / `stage-shared` / `core-agent` 0.x SemVer-locked，独立演进 | 完成（自 2026-06-23） |
| Godot 引擎集成 | `engines/stage-tamagotchi-godot`（Godot 4.6 + C# + Jolt + MToon + VRM addons）从 `axi-pet` 迁入 | 完成 |
| Hatsune Miku 资产 | 两个资产（注册入口 + 已审计的 2000×3000 中性底图） | 完成（2026-09-14）；voice / wake / Tailunorid 音频资产仍在按资产审计 |
| Provider 锁定 | MiniMax 作为唯一的 chat + speech 云端 provider；AGENTS 禁止 Ollama / Docker / local-model 路由 | 完成 |

## 说明

Axi Pet Desktop 是 macOS 优先的轻量 VRM 桌面宠物 Electron + React 19 monorepo，
已完全从上游 `axi-pet` 拆出，使用 `@axi-pet-desktop/*` 命名空间。单一 runtime
迁移（Phase A + B + C0–C4）清除了 `packages/ui` 中的 `.vue` / `vue` / `pinia`
/ `@vueuse/core`，并将它们在 `packages/stage-shared` 与 `packages/stage-ui-live2d`
中降级为 optional peerDeps（Phase A 2026-06-29）。Electron 主进程永不跨 IPC
边界传递 API key；MiniMax 是唯一的 chat + speech 云端 provider。本地 wake 是
针对罗马字 `yuzaki` 的 `openWakeWord` acoustic KWS，从 owner 录音训练；STT
优先使用共享 NewMax `SenseVoiceSmall`，可通过 `AIRI_SENSEVOICE_MODEL_PATH`
覆盖，fallback chain 为 `Sherpa Paraformer → local faster-whisper → Apple transcript`。
Cross-end contracts（`plugin-protocol` / `server-sdk` / `stage-shared` /
`core-agent`）是 0.x SemVer-locked，自 2026-06-23 起独立演进。历史上的
`apps/stage-tamagotchi/` Vue 3 目录已于 2026-08-11 `rm -rf`；仅留 git history。
最新已安装 `app.asar` SHA-256 =
`91b62390971a7d9822600d82b7ee396c2d461855385421cb2abcfaf6f569058c`（2026-08-11）。
最新证据时间戳 `2026-09-25`（`docs/HANDOFF.md`）。对 `apps/desktop-pet/**`
runtime / voice / STT / packaging / UI 任何修改的 Agent completion workflow
要求 `rebuild:mac` → 停止运行中的 `Axi Pet Desktop` / `AxiPetSpeechBridge` →
拷贝到 `/Applications/` → 启动 → 恢复
`~/Library/LaunchAgents/com.mose.AxiPetDesktop.plist`。

## 权威文档

- [`AGENTS.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/AGENTS.md) — 项目边界、scope table、读序、验证契约、request defaults。
- [`CLAUDE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CLAUDE.md) — Claude Code 速查。
- [`README.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/README.md) + [`README.zh-CN.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/README.zh-CN.md) — 主入口。
- [`docs/ARCHITECTURE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/ARCHITECTURE.md) — 三层顶层结构 + 依赖图。
- [`docs/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/HANDOFF.md) — 零上下文接手 brief；最新证据时间戳 `2026-09-25`。
- [`apps/desktop-pet/AGENTS.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/apps/desktop-pet/AGENTS.md) — voice / STT / wake / wake training / agent completion workflow。
- [`TODO.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/TODO.md) — 当前原子 ledger（8 atomic CS）。
- [`CHANGE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CHANGE.md) — 顶层里程碑。
- [`CHANGELOG.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CHANGELOG.md) — release changelog。
- [`MILESTONE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/MILESTONE.md)、[`SEPARATION.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/SEPARATION.md)、[`INDEX.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/INDEX.md)。
- [`DESIGN.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/DESIGN.md)、[`PLAN.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/PLAN.md)、[`PRD.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/PRD.md) — 设计 + 分阶段计划。
- `docs/specs/2026-07-15-single-runtime-migration/PRD.md`、`docs/specs/2026-08-11-single-runtime-physical-removal/PRD.md`、`docs/specs/2026-06-29-stage-ui-live2d-react-migration/` — 单一 runtime 迁移决策。
- `docs/project-docs.manifest.json` — workspace catalog entry。

## 交叉引用

- 工作区注册：`/Volumes/code/workspace/WORKSPACE_INDEX.md`（`workbench/axi-pet-desktop`，约第 40 行区域）。
- Workspace JSON（权威）：`/Volumes/code/workspace/foundation/workspace-governance/workspace.json`。
- 对称上游：`/Volumes/code/workspace/workbench/axi-pet/AGENTS.md` 与 `/Volumes/code/workspace/workbench/axi-pet/AGENTS.en.md`。
- 上游 separation：`/Volumes/code/workspace/workbench/axi-pet/docs/SEPARATION-desktop.md` ↔ `SEPARATION.md`。
- 规则模块：`/Volumes/code/workspace/foundation/axi-rules/INDEX.md` — AR-BOOTSTRAP-001/002/002.1/003、AR-ROUTING-001/004/005、AR-VERIFY-001/002/003、AR-LIFECYCLE-001/002/003、AR-GIT-001。
- ADR 索引：`/Volumes/code/workspace/foundation/workspace-governance/docs/adr/` — ADR-001 governance-repo-as-index-plane、ADR-008 personal-os-repository-topology。
- 工作区脚本：`/Volumes/code/workspace/scripts/workspace-project`（list / whereami / deps / consumers / profile / health / verify）。
