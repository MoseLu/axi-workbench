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

# CLIProxyAPI Reference —— PRD 分片

> CLIProxyAPI Reference 在 Axi Docs 中的 PRD 分片。这*不是*项目自身的 PRD；它只记录 Axi Docs 呈现该项目时的自身需求。

## REQ-PROJ-CLIPROXYAPI-REFERENCE-001

| 字段 | 值 |
| --- | --- |
| 需求 | 为 CLIProxyAPI Reference 维护一份可被发现的 Axi Docs 档案。 |
| 验收 | `docs/content/{en,zh}/projects/cliproxyapi-reference/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` 均存在，且 frontmatter 有效。 |
| 依据 | `WORKSPACE_INDEX.md`（工作区策略）。 |

## REQ-PROJ-CLIPROXYAPI-REFERENCE-002

| 字段 | 值 |
| --- | --- |
| 需求 | 档案反映权威的工作区路径、分区与用途说明。 |
| 验收 | `pnpm --dir app projects:check --project=cliproxyapi-reference` 通过。 |
| 依据 | `WORKSPACE_INDEX.md` 分区表。 |

## 非目标

- Axi Docs 不拥有该项目；它只索引该项目。
- Axi Docs 不复制项目内部的设计、测试或路线图。
