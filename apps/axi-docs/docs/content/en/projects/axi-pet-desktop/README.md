---
id: axi-docs-en-projects-axi-pet-desktop
title: Axi Pet Desktop
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Pet Desktop
graph-tags: [Projects, workbench]
tags: [Axi Docs, Projects, workbench, desktop, electron, react, R3F, VRM]
description: Standalone macOS-first Electron + React 19 + R3F VRM desktop pet monorepo extracted from axi-pet. Active surface is @axi-pet-desktop/desktop-pet; historical stage-tamagotchi Vue 3 anchor remains as fallback only.
project:
  id: axi-pet-desktop
  partition: workbench
  path: /Volumes/code/workspace/workbench/axi-pet-desktop
  source-section: core
---

# Axi Pet Desktop

> Mirror of the project root `AGENTS.md` + `CLAUDE.md` + `README.md` + `docs/ARCHITECTURE.md` + `docs/HANDOFF.md`. Source of truth:
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/AGENTS.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/AGENTS.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/CLAUDE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CLAUDE.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/README.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/README.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/docs/ARCHITECTURE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/ARCHITECTURE.md),
> [`/Volumes/code/workspace/workbench/axi-pet-desktop/docs/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/HANDOFF.md).
> Section: core / Partition: `workbench/`.

## Summary

Axi Pet Desktop is a fully extracted Electron + React 19 monorepo for a macOS-first lightweight VRM desktop pet. The repo was peeled out of the upstream `axi-pet` monorepo on 2026-06-18 and is independently maintained under the `@axi-pet-desktop/*` namespace. Two Electron entry apps coexist: `apps/desktop-pet` (`@axi-pet-desktop/desktop-pet`, React 19 + React Three Fiber + Zustand + Radix UI) is the only actively runnable runtime, and `apps/stage-tamagotchi` (Vue 3) is retained as a historical migration anchor with explicit `*:tamagotchi` root-script variants. Single-runtime migration (Phase A + B + C0–C4) completed 2026-06-29: Vue / Pinia / @vueuse/core were demoted to optional peerDeps in `packages/stage-shared` and `packages/stage-ui-live2d`, four Pinia stores migrated to Zustand, and `packages/ui` is fully React 19 (no vue runtime). The Electron main process never crosses an IPC boundary with API keys; MiniMax is the only chat + speech cloud provider; local wake/STT is openWakeWord acoustic KWS plus an owner verifier and a faster-whisper sidecar fallback chain.

The desktop renderer replaces the deprecated `packages/stage-ui-three` with `packages/desktop-pet-renderer`, which exposes a three-layer surface (framework-agnostic three.js + pixiv-vrm primitives in `./runtime`, React 19 + R3F components in `./react`, and Zustand stores in `./stores`). The historical `apps/stage-tamagotchi` physical working tree was `rm -rf`-ed on 2026-08-11 per `docs/specs/2026-08-11-single-runtime-physical-removal/PRD.md`; only the git history remains. The companion `engines/stage-tamagotchi-godot/` Godot 4.6 integration (C#, Jolt Physics, MToon + VRM addons) was also moved from `axi-pet` to this repo and is wired to its own `project.godot` and `.sln`. Two Hatsune Miku assets (the registration entry, one audited 2000×3000 neutral base illustration) shipped 2026-09-14 with voice / wake / Tailunorid audio assets pending per-asset audit.

**Stage**: live monorepo, single-runtime (React 19).
**Canonical path**: `/Volumes/code/workspace/workbench/axi-pet-desktop`.
**Branch**: `agent/audit-fix-a02-pet-desktop-lockfile` (working tree clean aside from two new submit logs).
**Latest installed `app.asar` SHA-256**: `91b62390971a7d9822600d82b7ee396c2d461855385421cb2abcfaf6f569058c` (2026-08-11).
**Latest evidence timestamp**: `2026-09-25` (`docs/HANDOFF.md`).

## Stack

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

## Project Layout

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

## Build & Install

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

After any `apps/desktop-pet/**` change touching runtime / voice / STT / packaging / UI the **Agent completion workflow** (`apps/desktop-pet/AGENTS.md` § "Agent completion workflow") requires: `rebuild:mac` → stop any running `Axi Pet Desktop` / `AxiPetSpeechBridge` → copy `apps/desktop-pet/dist/mac-arm64/Axi Pet Desktop.app` to `/Applications/` → launch → restore `~/Library/LaunchAgents/com.mose.AxiPetDesktop.plist`. The latest installed `app.asar` SHA-256 was `91b62390971a7d9822600d82b7ee396c2d461855385421cb2abcfaf6f569058c` (2026-08-11).

## Verification

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

## Architecture Highlights

Axi Pet Desktop is organised as a three-layer monorepo: `apps/`, `packages/`, and `engines/`. The Electron process split (main / preload / renderer) is enforced inside `apps/desktop-pet`; the renderer is intentionally reduced to the pet, captions, transient input, and a small set of status affordances, while every API-bearing service (MiniMax chat, TTS, STT, wake, owner-verifier, LaunchAgent, context menu, deep links, file watcher) lives in the main process. `apps/desktop-pet/src/main/index.ts` is a thin shim that imports `./platform/index`, and `electron.vite.config.ts` keeps `@axi-pet-desktop/desktop-pet-renderer` out of `externalizeDeps` so packaged Electron never asks Node to execute TypeScript from `node_modules` for the renderer bundle.

`PetRuntimeService` is a 12-dependency cross-feature orchestrator that lives in `apps/desktop-pet/src/main/pet-runtime/pet-runtime-service.ts` and types everything explicitly (Config store, corpus store, LaunchAgent service, local STT, local wake, MiniMax client, model service, voice service, phrase library, proactive dialogue service, canonical line store, runtime event, soul runtime store, speaker profile, TTS orchestrator, plus `AppearanceContext`, trigger rules, wardrobe selection, voice session state). Voice session state is passed by reference (`VoiceSessionState`) because the coupled timer + flag + actor surface is too large to plumb explicitly; the helper surface in `apps/desktop-pet/src/main/voice/voice-session.ts` keeps that contract explicit (`voiceWakePersistent`, `voiceSessionActive`, `ownerVoiceAcceptedForSession`, `pendingFollowUpCommandCapture`, `conversationFollowUpUntil`, `activeTurnId`, `voiceSessionTimer`, `followUpCommandTimer`, `emptyCommandCaptureRetries`, `playbackActive`, `voiceState`, `acousticWakePrimary`, `paused`, `voiceService`, `localWake`). The phase split (Phase 4 split) extracts lifecycle helpers (`startVoiceSession`, etc.) out of the orchestrator while accepting the shared mutable record trade-off.

The VRM runtime package `@axi-pet-desktop/desktop-pet-renderer` (declared in `packages/desktop-pet-renderer/package.json` with explicit subpath exports: `.`, `./runtime/vrm`, `./runtime/vrm/utils`, `./runtime/appearance`, `./runtime/shader`, `./trace`, `./stores`, `./react`, `./assets/vrm`, `./assets/vrm/animations`) replaces the deprecated `packages/stage-ui-three`. Its three-layer split — framework-agnostic `runtime/` (three.js / pixiv-vrm primitives), `react/` (R3F components such as `<ThreeScene>` and `<VRMModel>`), and `stores/` (Zustand `useModelStore`) — gives business code a React-first surface while keeping the R3F-specific code framework-agnostic enough to swap if needed. `@moeru/eventa` provides trace primitives.

Single-runtime migration is the load-bearing decision behind the package layout. Phase A (2026-06-29) cleared `.vue` / vue runtime from `packages/ui`; Phase B moved `vue` / `@vueuse/core` / `pinia` to optional peerDeps in `packages/stage-shared`; Phase C0–C4 migrated four Pinia stores to Zustand, rewrote eight Vue composables as React 19 hooks or framework-agnostic pure functions, cleared residual `watchEffect` / `storeToRefs` from `Model.tsx` / `Live2DScene.tsx`, and switched `desktop-pet Live2DWardrobeScene` to static import. The electron-builder dependency list of `rebuild:mac` no longer contains `vue` / `@vueuse/core` (only `@vueuse/shared` via the indirect reka-ui dependency). After 2026-07-15 the physical working tree of `apps/stage-tamagotchi` was `rm -rf`-ed; after 2026-08-11 the entire `apps/stage-tamagotchi/` directory was physically removed and `pnpm-workspace.yaml` `apps/**` tightened to `apps/desktop-pet` (plus `!**/out/**` safety net).

Voice / STT / Wake boundaries are explicit and rule-bound. Wake is local openWakeWord acoustic KWS at `resources/wake/listener.py` for roman `yuzaki`, trained from owner recordings and validated against contrasting local speech; the optional owner verifier is a secondary safeguard only and AGENTS forbids growing homophone alias lists (`尾崎`/`鱼仔`/etc.). Apple Speech bridge `AxiPetSpeechBridge` may listen on `en_US + ja_JP + zh_CN` only while waiting for wake-word detection; Japanese recognition exists solely to improve wake recall. After wake arms the session, the same bridge uses `zh_CN` only for command capture. Confirmation STT prefers shared NewMax `SenseVoiceSmall` (`~/.newmax/models/sensevoice-small/{model.int8.onnx,tokens.txt}`); override via `AIRI_SENSEVOICE_MODEL_PATH`. Fallback chain is `shared SenseVoiceSmall → Axi Pet-managed Sherpa Paraformer → local faster-whisper → Apple transcript`. Models are never symlinks to external volumes — the NewMax reuse is allowed because it is a local internal-disk application cache.

Cross-end contracts (`plugin-protocol` / `server-sdk` / `stage-shared` / `core-agent`) are 0.x SemVer-locked and independently evolved since 2026-06-23: the repository owner pins the version, and consumers (e.g. upstream `axi-pet`) are not required to track. The Godot engine integration at `engines/stage-tamagotchi-godot` is also part of this repo: Godot 4.6 + C#, Jolt Physics, `Godot-MToon-Shader` and `vrm` editor plugins enabled, run/main_scene = `res://scenes/stage-root.tscn`, project assembly name `stage-tamagotchi-godot`. The desktop-side `apps/desktop-pet/scripts/` host the canonical rebuild (`rebuild-mac.mjs`), the speech-bridge build (`build-speech-bridge.mjs`), the STT / wake venv setup (`setup-local-stt-venv.mjs`, `setup-local-stt-model.mjs`, `setup-local-wake-venv.mjs`, `setup-wake-model.mjs`, `setup-mukuro-wake-model.mjs`), and the asset audit scripts (`audit-mukuro-assets.ts`, `audit-miku-assets.ts`, `audit-expression-matrix.ts`, `audit-expression-bundle.ts`, `run-all-audits.mjs`).

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Extracted from upstream | Peeled out of `axi-pet` into standalone repo | Done (2026-06-18) |
| Single-runtime Phase A | Clear `.vue` / vue runtime from `packages/ui` | Done (2026-06-29) |
| Single-runtime Phase B | Move `vue` / `@vueuse/core` / `pinia` to optional peerDeps in `packages/stage-shared` | Done (2026-06-29) |
| Single-runtime Phase C0–C4 | Migrate 4 Pinia stores to Zustand; rewrite 8 Vue composables as React 19 hooks / framework-agnostic pure functions; switch `desktop-pet Live2DWardrobeScene` to static import | Done (2026-06-29) |
| Stage-tamagotchi working tree removal | `rm -rf` historical `apps/stage-tamagotchi/` and tighten `pnpm-workspace.yaml` `apps/**` to `apps/desktop-pet` | Done (2026-07-15 → 2026-08-11) |
| VRM runtime package | `packages/desktop-pet-renderer` (R3F + pixiv-vrm) replaces deprecated `packages/stage-ui-three` | Done |
| Voice / STT / Wake boundary | openWakeWord acoustic KWS + owner verifier + Apple Speech bridge + faster-whisper fallback chain | Done |
| Cross-end contracts | `plugin-protocol` / `server-sdk` / `stage-shared` / `core-agent` 0.x SemVer-locked, independently evolved | Done (since 2026-06-23) |
| Godot engine integration | `engines/stage-tamagotchi-godot` (Godot 4.6 + C# + Jolt + MToon + VRM addons) migrated from `axi-pet` | Done |
| Hatsune Miku assets | Two assets (registration entry + audited 2000×3000 neutral base illustration) | Done (2026-09-14); voice / wake / Tailunorid audio assets pending per-asset audit |
| Provider lock-in | MiniMax as the only chat + speech cloud provider; AGENTS forbids Ollama / Docker / local-model routing | Done |

## Notes

Axi Pet Desktop is a fully extracted Electron + React 19 monorepo for a macOS-first
lightweight VRM desktop pet under the `@axi-pet-desktop/*` namespace. Single-runtime
migration (Phase A + B + C0–C4) cleared `.vue` / `vue` / `pinia` / `@vueuse/core`
from `packages/ui` and demoted them to optional peerDeps in `packages/stage-shared`
and `packages/stage-ui-live2d` (Phase A 2026-06-29). The Electron main process
never crosses an IPC boundary with API keys; MiniMax is the only chat + speech
cloud provider. Local wake is `openWakeWord` acoustic KWS for roman `yuzaki`,
trained from owner recordings; STT prefers shared NewMax `SenseVoiceSmall` with
override `AIRI_SENSEVOICE_MODEL_PATH`, falling back to `Sherpa Paraformer → local faster-whisper → Apple transcript`. Cross-end contracts
(`plugin-protocol` / `server-sdk` / `stage-shared` / `core-agent`) are 0.x
SemVer-locked, independently evolved since 2026-06-23. The historical
`apps/stage-tamagotchi/` Vue 3 directory was `rm -rf`-ed 2026-08-11; only git
history remains. Latest installed `app.asar` SHA-256 =
`91b62390971a7d9822600d82b7ee396c2d461855385421cb2abcfaf6f569058c` (2026-08-11).
Latest evidence timestamp `2026-09-25` (`docs/HANDOFF.md`). Agent completion
workflow after any `apps/desktop-pet/**` runtime/voice/STT/packaging/UI change
requires `rebuild:mac` → stop running `Axi Pet Desktop` / `AxiPetSpeechBridge` →
copy to `/Applications/` → launch → restore
`~/Library/LaunchAgents/com.mose.AxiPetDesktop.plist`.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/AGENTS.md) — project boundary, scope table, read order, verification contracts, request defaults.
- [`CLAUDE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CLAUDE.md) — quick reference for Claude Code.
- [`README.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/README.md) + [`README.zh-CN.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/README.zh-CN.md) — primary entrypoints.
- [`docs/ARCHITECTURE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/ARCHITECTURE.md) — three-layer top-level structure + dependency diagram.
- [`docs/HANDOFF.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/docs/HANDOFF.md) — zero-context takeover brief; latest evidence timestamp `2026-09-25`.
- [`apps/desktop-pet/AGENTS.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/apps/desktop-pet/AGENTS.md) — voice / STT / wake / wake training / agent completion workflow.
- [`TODO.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/TODO.md) — current atomic ledger (8 atomic CS).
- [`CHANGE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CHANGE.md) — top-level milestones.
- [`CHANGELOG.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/CHANGELOG.md) — release changelog.
- [`MILESTONE.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/MILESTONE.md), [`SEPARATION.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/SEPARATION.md), [`INDEX.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/INDEX.md).
- [`DESIGN.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/DESIGN.md), [`PLAN.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/PLAN.md), [`PRD.md`](/Volumes/code/workspace/workbench/axi-pet-desktop/PRD.md) — design + staged plan.
- `docs/specs/2026-07-15-single-runtime-migration/PRD.md`, `docs/specs/2026-08-11-single-runtime-physical-removal/PRD.md`, `docs/specs/2026-06-29-stage-ui-live2d-react-migration/` — single-runtime migration decisions.
- `docs/project-docs.manifest.json` — workspace catalog entry.

## Cross-References

- Workspace registration: `/Volumes/code/workspace/WORKSPACE_INDEX.md` (`workbench/axi-pet-desktop`, line 40 area).
- Workspace JSON (canonical): `/Volumes/code/workspace/foundation/workspace-governance/workspace.json`.
- Symmetric upstream: `/Volumes/code/workspace/workbench/axi-pet/AGENTS.md` and `/Volumes/code/workspace/workbench/axi-pet/AGENTS.en.md`.
- Upstream separation: `/Volumes/code/workspace/workbench/axi-pet/docs/SEPARATION-desktop.md` ↔ `SEPARATION.md`.
- Rule module: `/Volumes/code/workspace/foundation/axi-rules/INDEX.md` — AR-BOOTSTRAP-001/002/002.1/003, AR-ROUTING-001/004/005, AR-VERIFY-001/002/003, AR-LIFECYCLE-001/002/003, AR-GIT-001.
- ADR index: `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/` — ADR-001 governance-repo-as-index-plane, ADR-008 personal-os-repository-topology.
- Workspace scripts: `/Volumes/code/workspace/scripts/workspace-project` (list / whereami / deps / consumers / profile / health / verify).
