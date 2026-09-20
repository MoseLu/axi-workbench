---
id: axi-docs-zh-projects-cliproxyapi-reference
title: CLIProxyAPI Reference
type: project
status: active
tags: [Axi Docs, 项目, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: CLIProxyAPI Reference
graph-tags: [项目, references]
description: 经过脱敏的 Go 参考代理服务，面向 OpenAI/Gemini/Claude/Codex 兼容的 CLI 接口、OAuth 多账号路由以及 SDK 转换模式。
project:
  id: cliproxyapi-reference
  partition: references
  path: /Volumes/code/workspace/references/cliproxyapi
  source-section: reference
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# CLIProxyAPI Reference

> 工作区项目档案。权威来源：`/Volumes/code/workspace/references/cliproxyapi`。
> 章节：reference / 分区：`references/`。

## 摘要

经过脱敏的 Go 参考代理服务，面向 OpenAI/Gemini/Claude/Codex 兼容的 CLI 接口、OAuth 多账号路由以及 SDK 转换模式。

## 技术栈

Go、Docker

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) —— 分区表中 "CLIProxyAPI Reference" 一行。
- 项目根目录：`/Volumes/code/workspace/references/cliproxyapi`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/cliproxyapi/AGENTS.md`（若存在）。
- 项目 `README.md`：`/Volumes/code/workspace/references/cliproxyapi/README.md`（若存在）。

## 备注

导入时已剥离 `.git`、本地二进制、运行期配置、鉴权材料以及运行时输出。仅作为参考使用。

## 验证（建议）

_请参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本中定义的权威验证命令。始终从项目目录运行，而不是从本档案目录运行。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` —— Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` —— 工作区项目路由。
- `app/src/config/documentSources.ts` —— Axi Docs 文档源注册表。
