---
id: axi-docs-en-projects-axi-workbench
title: Axi 工作台
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-08-07
modified: 2026-08-07
graph-title: Axi Workbench
graph-tags: [Projects, projects]
description: AxiomaticWorld 的规范工作台，覆盖六层控制平面、两个独立用户应用（Web 管理端 apps/workbench 与移动应用 apps/workbench-mobile）、共享契约、本地服务、AI 集成、集群工具与应用脚手架。
project:
  id: axi-workbench
  partition: projects
  path: /Volumes/code/workspace/projects/axi-workbench
  source-section: core
---
## 2026-08-07 同步记录

记录了 v3 双应用态势（独立的 Web 与移动应用）以及新的共享基础包 `@axi/workbench-foundation`。源镜像位于项目根目录的 `README.md`；规范的长篇文档位于 `docs/state/PRD.md` 与 `docs/state/TDD.md`。


# Axi 工作台

> 工作区项目档案。事实来源：`/Volumes/code/workspace/projects/axi-workbench`。
> 板块：core / 分区：`projects/`。

## 摘要

AxiomaticWorld 的规范工作台，覆盖六层控制平面、控制台应用、共享契约、本地服务、AI 集成、集群工具与应用脚手架。

## 技术栈

_未在 WORKSPACE_INDEX.md 中记录技术栈。_

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表中的行 "Axi Workbench"。
- 项目根目录：`/Volumes/code/workspace/projects/axi-workbench`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/projects/axi-workbench/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/projects/axi-workbench/README.md`（如存在）。

## 备注

_无备注。_

## 验证（建议）

_参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。务必在项目目录下运行，而非本档案。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` — 工作区项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。
