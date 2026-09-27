---
id: axi-docs-zh-projects-axi-soul-world-milestone
title: "Axi Soul World — Milestone"
type: project
status: published
tags: [Axi Docs, Projects, products, milestone]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Axi Soul World 产品的里程碑跟踪。
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
---

# Axi Soul World — Milestone

> 镜像 `/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md`；
> 以项目根计划为准。

## 当前活跃里程碑

**M1 — 三端拆分 + `axi-soul-api` 骨架 + Todo v3（进行中，2026-08-24）。**

- 手机端从未立项的 `axi-mood-app/` 改名为 `apps/android/`。
- 产品核心 `axi-soul-api/` 初始化：CMake presets，分层
  domain/application/platform/infrastructure/transport，回环
  `/healthz` 与 `/readyz`，空存储适配器，契约测试。Drogon 由 Conan
  门控，尚未作为默认传输层。
- 拆出 Admin Web（`apps/web-admin/`）与 Web BFF（`apps/web-bff/`）；v1 BFF
  并入核心后台进程。
- Android Todo 重做：Today 卡片、Today/Active/Done 筛选、逾期/即将到期/
  无日期分区、进度反馈、紧凑行、Material 日期/时间选择器、v3 生命周期
  历史（今日 = 今日或逾期未完成；Active = 所有未完成按到期日分组；Done =
  按日期的历史视图）、活动事件、完成时间戳、一次性提醒、15 分钟 snooze。

## 后续

- **M2 — `axi-soul-api` 可运行服务**：接入 Drogon 传输层、PostgreSQL +
  版本化 migration、把 `null_adapters` 的内存存储替换为真实适配器。
- **M3 — 管理 Web QR 登录 + Android 扫码批准**：落地微信式扫码流程；
  手机端不再展示 QR。
- **M4 — 打卡领域历史**：从"项目 + 最后一次日期"迁移到按日 `occurrence`
  历史，并在领域层计算连续天数。
- **M5 — 显式同步**：`syncEnabled` 开关、outbox/inbox、游标同步、冲突
  UI；默认仍以本地为权威。

## 验证

- [x] `axi-soul-api` CMake presets 构建（debug）与契约测试在本机通过。
- [x] Android `:app:checkDesignTokens` 审计通过；
      `:app:testDebugUnitTest` 在最新 Todo 模块变更后通过。
- [x] 真机 `m7lru45xu4mjcq7x` 上 Android 安装与 UI 烟雾测试通过
      （Todo Today/Active/Done、二级编辑器、Material 日期/时间选择器）。
- [ ] 管理 Web QR 登录与 Android 扫码批准端到端烟雾测试。
- [ ] PostgreSQL migration 升降级；OpenAPI 契约测试对 `axi-soul-api` 通过。
- [ ] Owner 接受 `BACKEND_CONTRACT.md` 边界。