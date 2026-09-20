---
id: axi-docs-zh-projects-codex-plus-app
title: Codex Plus App
type: project
status: draft
tags: [Axi Docs, 项目, tools, codex-plus-app]
created: 2026-06-10
modified: 2026-06-10
graph-title: Codex Plus App
graph-tags: [项目, tools]
description: 工作区下 `tools/codex-plus-app` 目录的占位档案。该项目**无任何门面文件**（无 AGENTS.md / README.md / package.json 等），本档案仅为可发现性而存在。
project:
  id: codex-plus-app
  partition: tools
  path: /Volumes/code/workspace/tools/codex-plus-app
  source-section: core
  mirror-strategy: hand-curated-minimal
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md; project has no face-level docs
---

# Codex Plus App — 项目档案

> 工作区项目档案。真源：`/Volumes/code/workspace/tools/codex-plus-app`。
> 分区：tools。
> **镜像策略**：手工最小集。该项目**无任何门面文件**（无 `AGENTS.md` / `README.md` / `CHANGELOG.md` / `package.json`），本档案仅为可发现性占位。

## 摘要

`tools/codex-plus-app` 是工作区下一个本地目录，用作 Codex Plus CDP 包装 / 应用 scratch space。当前只含：

- `outputs/`（空）
- `work/`（空）
- `.omx/metrics.json`（OMX 编排器运行时状态——**不**是项目本身的一部分）

在缺少上游文档时无法判断其具体用途。**需要 owner 行动**：在项目根添加门面文档（`AGENTS.md` / `README.md`），或将目录内容迁入既有项目。

## 技术栈

- **无记录**。无 `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` 等清单。

## 权威文档

- 工作区项：`/Volumes/code/workspace/tools/codex-plus-app`（无门面）
- 上游：未知 — 目录内无 `README.md` / `AGENTS.md`

## 备注

- 该项目**不**在 `WORKSPACE_INDEX.md`，`app/scripts/build-projects-index.mjs` 不会自动为其建档。
- `outputs/` 和 `work/` 均为空，提示该项目可能为 OMX 工作目录或占位。
- `.omx/metrics.json` 是 OMX 编排器状态，**不得**提交（见 `AGENTS.md` House Rules）。

## 验证

- 无验证命令 — 无源代码、无清单、无构建。

## 跨引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费工作区索引
- `docs/content/{en,zh}/guide/routing.md` — 工作区项目路由
- `app/src/config/documentSources.ts` — Axi Docs 源注册
