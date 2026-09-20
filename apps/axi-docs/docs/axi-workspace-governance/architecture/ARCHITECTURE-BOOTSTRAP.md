---
id: reference-workspace-architecture-bootstrap
title: Axi 工作区项目准入
type: reference
status: evergreen
tags: [workspace, architecture, bootstrap, project-admission]
created: 2026-08-22
modified: 2026-08-22
agent-readable: true
---

# Axi 工作区项目准入

> 来源：[`.workspace/reports/workspace-doc-audit.html`](workspace-doc-audit.html) · v5 · 2026-08-21

## 准入决策

新建/修改前必经的 5 步门槛。`route-intent` 根据意图/domain/领域/capability 决定 5 种动作之一：

| 决策 | 说明 |
|------|------|
| `reuse-existing` | 命中已有项目 owner |
| `shared-provider` | 命中已有能力 provider |
| `new-project-candidate` | 需要独立边界才允许 |
| `incubate` | 非项目验证区（不在主线） |
| `rejected` | 不创建项目文件 |

---

## 5 步流程

### 第 0 步 · route-intent

```bash
workspace-project route-intent --intent <意图> --domain <领域> [--capability <能力>] --json
```

返回 `requiredReads` 路径，必须先读取后再创建文件。

---

### 第 1 步 · 5 件齐

每个新项目必须具备 **5 个 agent-readable 文件**：

| 文件 | 说明 |
|------|------|
| `AGENTS.md` | Agent 入口与边界 |
| `README.md` | 目的 + 搭建 + 常用命令 |
| `docs/HANDOFF.md` | 当前工作 / 命令 / 契约 / 故障排查 / 新鲜度 |
| `CHANGE.md` | 根级变更记录 |
| `INDEX.md` | 项目索引（可选，见下方） |

**可选 4 件**（源存在性驱动）：

| 文件 | 说明 |
|------|------|
| `docs/state/TODO.md` | 待办 |
| `docs/state/MILESTONE.md` | 里程碑 |
| `docs/state/CHANGELOG.md` | 变更日志 |
| `app/` | 应用包（如需要） |

---

### 第 2-5 步 · 三件套校验

**所有 3 件都必须 0 错误**：

```bash
# 步骤 1：工作区验证
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate

# 步骤 2：审计检查
node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-audit.mjs

# 步骤 3：文档同步
cd /Volumes/code/workspace/infra/axi-workspace-governance && pnpm workspace:docs:sync
```

---

## 强制规则

- ❌ 不在 `/Volumes/code/workspace` 执行 `git init`
- ❌ 不从根目录 commit / push / clean / reset
- ✅ 代码修改进入拥有该代码的项目仓库
- ✅ 治理修改进入 `infra/axi-workspace-governance`

---

## 相关文档

- [架构总览](ARCHITECTURE-OVERVIEW.md)
- [架构层详解](ARCHITECTURE-LAYERS.md)
- [修改触发链路](ARCHITECTURE-CHANGE-TRIGGERS.md)
