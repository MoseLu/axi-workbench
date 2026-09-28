---
id: axi-docs-zh-guide-workspace
title: 工作区
type: guide
status: published
tags: [Axi Docs, Workspace, 治理, 中文]
created: 2026-06-07
modified: 2026-06-07
graph-title: 工作区
graph-tags: [Axi Docs, Workspace]
description: 了解工作区文档集如何组织项目索引、治理说明和长期知识。
---

## 工作区文档集

工作区文档集连接 Axi 工作区治理仓库，集中呈现项目目录、治理规则和跨项目知识。它不是文件浏览器，而是面向阅读与检索的结构化入口。

## 目录组织

左侧侧栏由工作区目录数据生成。每个分组包含说明、文档数量和具体页面；正文区域显示当前来源概览、最近更新和可打开的条目。

## 适合记录的内容

- 项目定位、边界和依赖关系。
- 跨仓库治理规则与操作流程。
- 架构决策、迁移说明和维护手册。
- 可以长期复用的排障与验证证据。

## 与技能库的边界

工作区回答“这个项目或环境是什么”，技能库回答“如何执行一种可复用任务”。避免在两个文档集中复制同一份运行说明，使用链接连接它们。

## 工作区长期状态文档

Axi 工作区在 `docs/state/` 维护一组长期状态文档，并镜像到 `apps/axi-docs/docs/axi-workspace-governance/state/`：

| 文档 | 用途 |
| --- | --- |
| `README.md` | 目录入口与文件类型矩阵 |
| `PRD.md` | 工作区根 PRD（REQ-DOC-001 / REQ-VERIFY-001 / REQ-BOUNDARY-001 / REQ-MILESTONE-001） |
| `TDD.md` | 工作区根 TDD（架构假设、验证命令） |
| `TODO.md` | 工作区根 P0/P1/P2 任务队列 |
| `MILESTONE.md` | 工作区根里程碑（WRK.1 / WRK.2 / WRK.3）及验收标准 |
| `VERIFICATION.md` | 工作区验证状态（自动生成） |
| `CLI-REFERENCE.md` | workspace-project / devsvc / foundation CLI 参考 |

历史事件快照（LOG-STD / TASK3 / audit-remediation / git-ahead 等）归档在 `apps/axi-docs/docs/axi-workspace-governance/audits/2026-09-25/` 下。

## 工作区架构与运行

长期的架构与运行说明集中在 `docs/architecture/`、`docs/audit/`、`docs/registry/` 与 `docs/prd/` 中。它们被镜像到：

- `apps/axi-docs/docs/axi-workspace-governance/workspace-architecture/` — 工作区级架构（7 篇）
- `docs/axi-workspace-governance/audit/` — 工作区级审计（2 篇）
- `docs/axi-workspace-governance/registry/` — 工作区级注册表（1 篇）
- `docs/axi-workspace-governance/prd/` — PRD 中心（6 篇）

ADR 入口位于 `/Volumes/code/workspace/docs/adr/README.md`，该入口委托到权威目录 `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`。

## ADR 权威源

本工作区共有三处 ADR 目录：
1. `/Volumes/code/workspace/docs/adr/` — 临时 ADRs 占位（1 个 README）
2. `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/adr/` — 治理仓库镜像
3. `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/` — **权威源**

使用 `axi_docs_list_governance_adrs` 可一次性枚举这三处目录。

## Axi 品牌与契约

Axi 工作区在 `docs/axi/` 下维护品牌命名契约，已镜像到 `apps/axi-docs/docs/axi-workspace-governance/axi/`：

| 文档 | 类型 | 镜像位置 |
| --- | --- | --- |
| `AXIOMATICWORLD_NAMING.md`（en/zh-CN） | 品牌命名契约 | `axi/AXIOMATICWORLD_NAMING.md` |
| `contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md` | 工作区共享 schema（467 行，强契约） | `axi/contracts/` |
| `contracts/AI_CAPABILITY_CONTRACT.md` | cc-connect ai-capability 契约 | `axi/contracts/` |
| `contracts/MINIMAX_TOKENPLAN_CONTRACT.md` | cc-connect minimax-tokenplan 契约 | `axi/contracts/` |
| `contracts/OLLAMA_LOCAL_CONTRACT.md` | cc-connect ollama-local 契约 | `axi/contracts/` |
| `merge-plans/AXI_*.md`（4 份，已冻结） | 历史合并计划 | `axi/archive/` |

读取这些文档可用 `axi_docs_read_workspace_doc(category='axi', path='contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md')`。

## 工作区元文档（第 1-2 层）

Claude CLI 的元文档 `.claude/PARADIGM.md`（第 1 层：范式）和 `.claude/ARCHITECTURE.md`（第 2 层：架构）定义工作区级别的约定。它们被镜像到：

- `apps/axi-docs/docs/axi-workspace-governance/claude-meta/PARADIGM-WORKSPACE-ROOT.md`
- `apps/axi-docs/docs/axi-workspace-governance/claude-meta/ARCHITECTURE-WORKSPACE-ROOT.md`

这两份是 AxiomaticWorld 工作区的“宪法”，每个智能体在首次接触时都会读取。

## 脚本目录与孵化区

`scripts/` 目录托管根级启动脚本与第 3 层模块文档（AGENTS.md / README.md），已镜像到 `apps/axi-docs/docs/axi-workspace-governance/scripts/`。`incubator/` 是非项目的验证区，按规则不被 Axi Docs 收录；新想法先进入这里，再通过 `workspace-project route-intent` 提升到 `foundation/` 或 `products/`。
