---
id: axi-docs-zh-projects-axi-soul-world
title: Axi Soul World
type: project
status: published
tags: [Axi Docs, Projects, products, core]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Axi Soul World 的本地优先多端产品 —— 本仓产品核心、Axi Mood Android 客户端、管理 Web（后续打包成 Mac）以及微信式扫码登录。
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: core
---

# Axi Soul World

> 项目根 [`README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md) 的镜像；以项目根为准。
> Section: core / Partition: `products/`。

## 概述

本地优先的多端产品：本仓内的产品核心（`axi-soul-api`）、Axi Mood Android
手机端、管理 Web（后续打包成 Mac）以及 Web BFF。电脑展示登录二维码，
手机扫描并批准；手机端不展示二维码。`axi-mood-app/` 目录已并入
`apps/android/`；`com.axi.mood` 只是历史 applicationId。

**当前阶段**：正式项目（产品与运行时仍按 PRD/P0/P1/P2 分阶段实现）。
**规范路径**：`/Volumes/code/workspace/products/axi-soul-world`。

分支约定：`main` 只承载可发布生产版本，`dev` 承载日常集成；新功能从
`dev` 创建 `feature/*`、`fix/*` 或 `codex/*` 等短分支，通过验证后合并回
`dev`，发布时再经审查合并到 `main`。

## 技术栈

| 接入面 | 技术 | 说明 |
| --- | --- | --- |
| 产品核心 `axi-soul-api` | C++20 模块化骨架（CMake presets，domain/application/platform/infrastructure/transport 分层） | 领域 + 用例 + 稳定契约；不是 Android 工程 |
| 本地运行时 | Android SQLite（目前唯一规范运行时） | 默认本地权威；显式开启同步后才接远端 |
| Web BFF | `apps/web-bff` 契约，v1 并入核心后台进程 | Cookie 会话、登录 QR、管理页 DTO |
| 管理 Web | `apps/web-admin` 网页 MVP | 大屏整理；后续同一 UI 打成 Mac |
| Android 接入面 | Kotlin + XML View | Axi Mood 手机端：记录与扫码批准 |
| JNI 辅助 | C++ `axi_core` | 仅手机端时间/相册分组，不是产品核心 |
| 认证辅助 | Rust (`axi-auth-helper`) | 本机打开授权 URL，不是业务后台 |
| 设计系统 | `axi_tokens.xml`、后续 `@axi/*` | 语义化设计 token |

## 项目结构

```text
axi-soul-world/
├── axi-soul-api/           # 产品核心后台（领域 + 可替换运行时）
├── apps/web-bff/           # 管理 Web 的 BFF 契约（v1 实现并入核心后台）
├── apps/web-admin/         # 管理网页 MVP，后续打成 Mac
├── apps/mac-admin/         # Mac 壳预留，复用 web-admin
├── apps/android/           # 手机端（Gradle 工程）
├── axi-auth-helper/        # Rust 本机授权 helper
├── docs/architecture/      # 三端拆分与 BFF 边界
├── architecture-inputs/    # API、同步、安全输入
├── BACKEND_CONTRACT.md     # 跨运行时稳定契约
└── BACKEND_ARCHITECTURE_PLAN.md
```

不要把 `apps/android` 再拆成另一个产品仓库。领域与存储按行为测试下沉到
`axi-soul-api`；手机端逐步只保留 UI、本地适配和扫码批准。

## 构建

```bash
# Debug
export ANDROID_HOME=/Users/mose/.local/opt/android-sdk
cd apps/android
./gradlew :app:assembleDebug

# Release
cd apps/android
./gradlew :app:assembleRelease
```

## 安装（需要设备指纹）

```bash
cd axi-soul-world
./apps/android/scripts/install-with-miui-tap.sh \
  apps/android/app/build/outputs/apk/release/app-release.apk \
  m7lru45xu4mjcq7x
```

## 验证

```bash
# 设计 token 审计
cd apps/android && ./gradlew :app:checkDesignTokens

# 工作区登记与文档接手检查
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs handoff-check axi-soul-world
```

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| PRD | 产品需求文档 | 完成 |
| P0 | 私密日记核心 | 进行中（Android MVP 已落地；后端仅回环） |
| P1 | 个人生活整理能力（待办/打卡/附件） | 进行中（Todo v3 已上线；打卡领域历史仍待补齐） |
| P2 | 加密备份与跨设备同步 | 待隐私方案确定 |

完整未发布历史见 [`CHANGE.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGE.md)；
分阶段计划见 [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md)。

## 权威文档

- [`AGENTS.md`](/Volumes/code/workspace/products/axi-soul-world/AGENTS.md) — 项目边界与验证规则
- [`README.md`](/Volumes/code/workspace/products/axi-soul-world/README.md) — 主入口
- [`CHANGE.md`](/Volumes/code/workspace/products/axi-soul-world/CHANGE.md) — 变更日志
- [`TODO.md`](/Volumes/code/workspace/products/axi-soul-world/TODO.md) — 任务追踪
- [`PRD.md`](/Volumes/code/workspace/products/axi-soul-world/PRD.md) — 产品需求文档
- [`BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md) — 跨运行时契约
- [`BACKEND_ARCHITECTURE_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_ARCHITECTURE_PLAN.md) — 后端架构
- [`IMPLEMENTATION_PLAN.md`](/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md) — 分阶段实施计划
- [`docs/HANDOFF.md`](/Volumes/code/workspace/products/axi-soul-world/docs/HANDOFF.md) — 零上下文接手入口
- [`docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md) — 核心后台 / 管理 Web / 手机端拆分
- [`apps/android/README.md`](/Volumes/code/workspace/products/axi-soul-world/apps/android/README.md) — 手机端
- [`axi-soul-api/README.md`](/Volumes/code/workspace/products/axi-soul-world/axi-soul-api/README.md) — 产品核心后台