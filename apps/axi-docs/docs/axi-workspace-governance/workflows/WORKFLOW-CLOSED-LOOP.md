---
id: reference-workspace-workflow-closed-loop
title: Axi 工作区闭合链路
type: reference
status: evergreen
tags: [workspace, workflow, closed-loop, governance]
created: 2026-08-22
modified: 2026-08-22
agent-readable: true
---

# Axi 工作区闭合链路

> 来源：[`.workspace/reports/workspace-doc-audit.html`](workspace-doc-audit.html) · v5 · 2026-08-21

## 概述

**闭合链路**是 Axi 工作区的核心治理机制：**任何修改都走这条环**，确保真相源与消费方保持同步。

```
修改源文件 → 生成器重跑 → 镜像刷新 → 三件套校验 → 失败阻塞 commit → 4 CLI + 前端消费
```

---

## 完整链路

### 第 1 步：修改源文件

触发源包括：
- 根规则文件（`AGENTS.md`、`WORKSPACE_INDEX.md`）
- 规则条目（`projects/axi-rules/`）
- ADR 决策（`projects/axi-rules/rules/`）
- 共享包（`shared/`）
- 前端代码（`projects/*/app/`）
- 注册表（`infra/axi-workspace-governance/`）

### 第 2 步：生成器重跑

自动触发生成器：
- 文档同步器 → `projects/axi-docs/docs/axi-workspace-governance/`
- 前端镜像 → `dist/`
- 适配器扇出 → 4 个 CLI 的 AGENTS 镜像

### 第 3 步：镜像刷新

生成产物更新到消费方可访问的位置：
- JSON 快照
- Markdown 文档
- 前端构建产物

### 第 4 步：三件套校验

Commit 前必须全部通过：

```bash
# 1. 工作区验证
node scripts/workspace-project-cli.mjs validate

# 2. 审计检查
node scripts/workspace-audit.mjs

# 3. 文档同步
pnpm workspace:docs:sync
```

### 第 5 步：失败阻塞

**任一失败 → commit 被拒**

```
validate 失败 → 阻止 commit
audit 失败 → 阻止 commit
docs-sync 失败 → 阻止 commit
```

### 第 6 步：消费方生效

成功后，以下消费方自动看到更新：
- 4 个 CLI（Claude / Codex / Gemini / OpenCode）
- 前端应用（Axi Workbench 等）
- explorer agent

---

## 漂移检测

### 触发条件

第①步任何文件被修改时：
1. 立刻触发第②步重跑
2. 否则第③步校验失败
3. commit 被拒
4. **强制环路闭合**

### 已知漂移

| 产出 | 滞后时间 | 风险 |
|------|----------|------|
| 校验 JSON | 65 天 | 高 |
| 前端 dist/ | 7-8 天 | 中 |

---

## 快速命令

```bash
# 强制刷新所有生成产物
cd /Volumes/code/workspace/infra/axi-workspace-governance
pnpm workspace:docs:sync

# 验证工作区状态
node scripts/workspace-project-cli.mjs validate

# 运行审计
node scripts/workspace-audit.mjs
```

---

## 相关文档

- [架构总览](../architecture/ARCHITECTURE-OVERVIEW.md)
- [数据流转](../architecture/ARCHITECTURE-DATA-FLOW.md)
- [修改触发链路](../architecture/ARCHITECTURE-CHANGE-TRIGGERS.md)
