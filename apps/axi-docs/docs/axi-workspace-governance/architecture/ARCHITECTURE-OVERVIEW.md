---
id: reference-workspace-architecture-overview
title: Axi 工作区架构总览
type: reference
status: evergreen
tags: [workspace, architecture, governance, overview]
created: 2026-08-22
modified: 2026-08-22
agent-readable: true
---

# Axi 工作区架构总览

> 来源：[`.workspace/reports/workspace-doc-audit.html`](workspace-doc-audit.html) · v5 · 2026-08-21

## 概览

Axi 工作区是 **非 Git 容器**（ADR-003），承载 **6 大架构层 + 1 条闭环链路**：

| 层 | 名称 | 说明 |
|---|---|---|
| 第一层 | 政策与规则 | 约束源头，62 条 AR-* 规则 |
| 第二层 | 项目 | 业务承载，20 个登记项目 |
| 第三层 | 工具链 | 自动化底座，18 子命令 |
| 第四层 | 生成产物 | 自动派生，9 份文档 |
| 第五层 | 适配器 | 多 CLI 镜像，4 个 CLI |
| 闭环 | 闭合链路 | 任何修改都走这条环 |

## 图例

| 标记 | 含义 |
|------|------|
| 实心蓝边 | 核心模块 |
| 灰斜体 | 非核心/排除 |
| 红边 | 时效性缺口 |
| 绿边 | 已对齐/强项 |

## 快速导航

- [架构层详解](ARCHITECTURE-LAYERS.md) — 6 大层的详细说明
- [数据流转](ARCHITECTURE-DATA-FLOW.md) — 从真源到消费方的 5 步链条
- [项目准入](ARCHITECTURE-BOOTSTRAP.md) — 新建/修改前的 5 步门槛
- [修改触发链路](ARCHITECTURE-CHANGE-TRIGGERS.md) — 改一处触发整个工作区的连锁反应
- [闭合链路](../workflows/WORKFLOW-CLOSED-LOOP.md) — 提交前的强制校验流程

## 核心契约

1. **根入口**：`/Volumes/code/workspace` 只承载项目目录、参考目录、生成快照和 launcher shim
2. **治理源**：`infra/axi-workspace-governance/` 是权威治理清单
3. **文档枢纽**：`projects/axi-docs/docs/axi-workspace-governance/` 是只读镜像
4. **三件套**：任何 commit 前必须通过 `validate` + `audit` + `docs-sync`
