---
id: axi-docs-en-projects-axi-pet-desktop
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

# CLAUDE.md

## Project Overview

`axi-pet-desktop` 是独立的 macOS-first Electron 桌面宠物 monorepo。
`apps/desktop-pet` 是唯一运行时：React 19 + R3F + Zustand，负责人物、衣橱、
语音、唤醒、本地 STT 与 MiniMax 编排。

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm -F @axi-pet-desktop/desktop-pet test:run
pnpm -F @axi-pet-desktop/desktop-pet rebuild:mac
```

## Active packages

- `desktop-pet-renderer`：R3F / VRM 渲染。
- `stage-ui-live2d`：React Live2D 场景和 Zustand stores。
- `stage-shared`、`ui`、`electron-screen-capture`、`audio`：无框架兼容层的活跃共享包。
- `plugin-protocol`、`server-sdk`、`core-agent`：独立演进的契约与核心能力。

## Completion workflow

影响 `apps/desktop-pet/**` runtime、voice、STT、packaging 或 UI 的变更必须执行
`pnpm -F @axi-pet-desktop/desktop-pet rebuild:mac`，安装生成的应用到 `/Applications/`，
并恢复 LaunchAgent。MiniMax 是唯一 chat 与 speech provider；API key 只可存在于
Electron main 进程。

单运行时退役决策见 `docs/specs/2026-07-15-single-runtime-migration/PRD.md`。
