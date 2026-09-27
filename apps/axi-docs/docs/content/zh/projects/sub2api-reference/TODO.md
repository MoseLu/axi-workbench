---
id: axi-docs-zh-projects-sub2api-reference
title: Sub2API Reference
type: project
status: active
tags: [Axi Docs, 项目, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: Sub2API Reference
graph-tags: [项目, references]
description: 参考性的 AI API 网关平台，用于订阅额度分配；仅作为 Axi Model Gateway 的 provider/model-source 参考。
project:
  id: sub2api-reference
  partition: references
  path: /Volumes/code/workspace/references/sub2api
  source-section: reference
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Sub2API Reference —— TODO

> 档案 TODO。记录 Axi Docs 还需要为该项目呈现哪些内容。

## P0

- [ ] 确认项目根目录的 `AGENTS.md` / `README.md` 仍然存在，并与 `WORKSPACE_INDEX.md` 一致。
- [ ] 呈现权威的验证命令（从项目 `AGENTS.md` 或 `package.json` 读取）。

## P1

- [ ] 如果项目暴露了 MCP 工具（例如 `axi_docs_*` 适配器、`workspace-project` 消费者），记录其第一方 MCP 工具映射。
- [ ] 通过 `workspace.graph.json` 链接到活跃的消费者（`workspace-project consumers <id>`）。

## P2

- [ ] 如果该项目是 Dashboard 应用，添加缩略图或图标。
- [ ] 当行为规则引用该项目时，交叉链接到 Axi Rules 条目（`rules/<family>/AGENTS.md`）。

## 不在范围内

- 项目内部的 TODO 写在项目根目录，而不是这里。
