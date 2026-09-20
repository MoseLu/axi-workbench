---
id: reference-axi-workspace-integration-map
title: Axi Workspace Integration Map
type: reference
status: evergreen
tags: [workspace, integration, contracts]
created: 2026-09-16
modified: 2026-09-16
agent-readable: true
---

# Axi Workspace Integration Map

最后生成：2026-09-16

## 跨仓协作契约

| Channel | Source | Target | Contract |
|---|---|---|---|
| registry | `workspace.json` | `.workspace/registry.json` | 工作区注册清单生成，不人工维护 |
| docs | `/Volumes/code/workspace/infra/axi-workspace-governance/docs` | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance` | 多仓索引文档镜像给 Axi Docs |
| package distribution | `shared/axi-ui` -> `infra/axi-registry` | `@axi/*` Node 消费仓库 | 通过 Verdaccio 分发，不走 Git Submodule |
| orchestration | `C:\Users\12081\.openclaw` | 工作区子项目 | 外部 canonical infra 编排入口 |

## Canonical / Upstream 对齐

- 当前没有登记 `upstream_remote` 的条目。

## 本地权威源（允许无远端）

- `../../projects/axi-pet` | Axi Pet | compliance=`node-monorepo-approved`
- `../../projects/axi-pet-desktop` | Axi Pet Desktop | compliance=`node-monorepo-approved`
- `../../products/ai-resource-orchestration` | 资源调度中心 | compliance=`node-monorepo-approved`
- `../../products/axi-artboard` | Axi Artboard | compliance=`node-monorepo-approved`
- `../../projects/axi-rules` | Axi Rules | compliance=`constraint-index`
- `../../references/archives/axi-video-downloader-2026-09-17` | Axi Video Downloader | compliance=`python-tool`
- `../../tools/axi-feishu-codex-bridge` | Axi Feishu Codex Bridge | compliance=`python-tool-local-runtime`

## 仓库命名策略

- 不对现有业务产品仓库做全量统一前缀重命名。
- 新增治理、基础设施、共享、Agent 支撑、工具仓库采用渐进式前缀命名。
- 当前建议模式：`workspace-<domain>-governance`、`infra-<capability>`、`shared-<capability>`、`agent-<capability>`、`tool-<capability>`。
