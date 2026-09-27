---
id: axi-docs-zh-projects-axi-soul-world-todo
title: "Axi Soul World — TODO"
type: project
status: published
tags: [Axi Docs, Projects, products, todo]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Axi Soul World 产品任务追踪的 dossier 视图。
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
---

# Axi Soul World — TODO

> 指向项目根任务追踪
> [`/Volumes/code/workspace/products/axi-soul-world/TODO.md`](/Volumes/code/workspace/products/axi-soul-world/TODO.md) 的镜像；
> 项目根文件是单一来源，会随工作推进更新。

## 项目 TODO 要点

- 已完成：Phase 0 产品边界、数据语义与后端准入检查；Phase 1 Android
  本地 SQLite 数据基础、JSON/RKStorage 迁移；日记、备忘录、待办、打卡
  的 Android 本地 MVP；C++20 prototype admission 复评。
- 已完成：统一 Android Todo Today/Active/Done 行动视图、完成历史、
  活动记录、一次性提醒（真机安装验证待解除设备安装限制）。
- 已完成：三端拆分落地在本仓（`axi-soul-api`、`apps/web-bff`、
  `apps/web-admin`，手机端在 `apps/android`）；未立项的 `axi-mood-app/`
  目录并入 `apps/android/`。
- 已完成：`axi-soul-api` C++20 分层骨架、回环 `/healthz` `/readyz`、
  空存储适配器。

## 下一步（当前项目 TODO）

- 用 Conan 接入 Drogon 生产传输层、PostgreSQL migration 与显式同步。
- 管理 Web 展示 QR，手机端增加扫码批准页；本机解锁页继续无 QR。
- 打卡领域层历史/时区计算、附件扩展与真机完整流程仍待补齐。
- 后端 route-intent / admission 必须先放行，才可对外承载服务。

契约边界见 [`BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md)
与 [`docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md)。