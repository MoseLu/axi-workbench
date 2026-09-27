---
id: reference-workspace-architecture-layers
title: Axi 工作区架构层详解
type: reference
status: evergreen
tags: [workspace, architecture, layers, governance]
created: 2026-08-22
modified: 2026-08-22
agent-readable: true
---

# Axi 工作区架构层详解

> 来源：[`.workspace/reports/workspace-doc-audit.html`](workspace-doc-audit.html) · v5 · 2026-08-21

---

## 第一层 · 政策与规则（约束源头）

| 模块 | 说明 |
|------|------|
| **根入口** | 声明分区、命名规则、项目选择、跨仓协调 |
| **权威索引 + 真源** | 人类索引 + 机器关系图 + 企业注册表 |
| **命名表** | 人类/机器/企业三层真源 |
| **ADR 决策** | 链式演进的架构决策记录（5 个决策） |
| **规则工程** | 62 条 AR-* 规则 · 12 维度 · 执行器 |

**ADR 清单：**
- ADR-001: governance-repo-as-index-plane
- ADR-002: progressive-repository-naming-policy
- ADR-003: workspace-root-is-non-git-container
- ADR-004: apm-agent-context-package-layer
- ADR-005: workflow-first-bounded-agent

---

## 第二层 · 项目（业务承载）

| 类型 | 说明 | 数量 |
|------|------|------|
| **独立产品** | 面向用户的应用 | 3 个 |
| **工程级 monorepo** | 大型跨域项目（最大消费汇聚点） | 9 个 + 规则仓 |
| **共享包** | 跨项目复用的资产（UI 主出口） | 3 个 |
| **基础设施** | 治理 / 注册中心 | 2 个 |
| **工具** | 小工具项目 | 3 个 |
| **引用仓** | 外部参考（审计排除） | - |
| **孵化区** | 非项目验证（不在主线） | - |

---

## 第三层 · 工具链（自动化底座）

| 模块 | 说明 |
|------|------|
| **主 CLI** | 18 子命令的统一入口，5 大类（查询/校验/状态/准入/路径） |
| **生成器** | 从真源生成快照/文档/镜像（10 个） |
| **运行时** | Node22 兼容 + 事件账本 |
| **wrapper** | 顶层薄壳，转发到真实现（部分已 deprecated） |

**生成器清单：**
- 文档同步器
- 代码镜像器
- 规则/契约/审计生成器

---

## 第四层 · 生成产物（自动派生）

| 模块 | 说明 | 状态 |
|------|------|------|
| **人类可读文档** | 9 份 markdown 渲染 | 核心 |
| **JSON 快照** | 机器消费的状态快照 | ⚠️ 校验滞后 65 天 |
| **前端镜像** | 前端运行时消费的副本 | ⚠️ dist 陈旧 7-8 天 |
| **CodeGraph 索引** | 代码知识图谱（15 处，~1 GB） | 根索引占 85% |

---

## 第五层 · 适配器（多 CLI 镜像）

| 模块 | 说明 |
|------|------|
| **用户级 CLI 指令** | 4 个 CLI 的 AGENTS 指令镜像（Claude/Codex/Gemini/OpenCode） |
| **工作区级镜像** | OpenCode 配置、Edit gate 钩子、Skill marketplace |
| **本地 AI 能力层** | ~/.cc-connect 守护进程生态（能力路由表/MCP server/本地模型） |

---

## 图例说明

| 标记 | 含义 |
|------|------|
| ⚠️ 红边 | 时效性缺口（需关注） |
| ✅ 绿边 | 已对齐/强项 |
| 灰斜体 | 非核心/排除 |

---

## 相关文档

- [架构总览](ARCHITECTURE-OVERVIEW.md)
- [数据流转](ARCHITECTURE-DATA-FLOW.md)
- [项目准入](ARCHITECTURE-BOOTSTRAP.md)
- [修改触发链路](ARCHITECTURE-CHANGE-TRIGGERS.md)
