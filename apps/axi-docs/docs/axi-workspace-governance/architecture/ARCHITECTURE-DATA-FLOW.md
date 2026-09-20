---
id: reference-workspace-architecture-data-flow
title: Axi 工作区数据流转
type: reference
status: evergreen
tags: [workspace, architecture, data-flow, pipeline]
created: 2026-08-22
modified: 2026-08-22
agent-readable: true
---

# Axi 工作区数据流转

> 来源：[`.workspace/reports/workspace-doc-audit.html`](workspace-doc-audit.html) · v5 · 2026-08-21

## 5 步链条

```
① 真相源 → ② 生成器 → ③ 三件套校验 → ④ 消费方
         ↑                                      |
         └──────────── 漂移触发器 ←──────────────┘
```

---

### ① 真相源

人写的、手维护的权威文件：

| 文件/目录 | 说明 |
|----------|------|
| `AGENTS.md` | Agent 入口指令 |
| `12 规则模块` | 规则源 |
| `5 个 ADR` | 架构决策记录 |
| `workspace.json` | 治理清单 |
| `workspace.graph.json` | 项目关系图 |
| `62 条 AR-*` | 规则条目 |

**位置：** `/Volumes/code/workspace/infra/axi-workspace-governance/`

---

### ② 生成器

从源派生文档/JSON：

| 生成器 | 说明 |
|--------|------|
| 文档同步器 | 同步到 `axi-docs` |
| 完成度快照 | `project-completion.json` |
| 交接快照 | `project-handoff.json` |
| 校验快照 | `verification.json` |
| 适配器扇出 | 4 个 CLI 的 AGENTS 镜像 |
| 前端镜像 | `dist/` 构建产物 |

---

### ③ 三件套校验

commit 前必须全绿：

```bash
pnpm workspace:docs:sync  # 文档同步
node workspace-audit.mjs  # 审计检查
node workspace-project-cli.mjs validate  # 验证
```

**任一失败 → commit 阻塞**

---

### ④ 消费方

真正使用的工作流：

| 消费方 | 说明 |
|--------|------|
| 4 个 CLI | Claude / Codex / Gemini / OpenCode |
| 前端应用 | Axi Workbench 等 |
| explorer agent | 代码探索代理 |

---

## 漂移触发器

```
第①步任何文件被修改
  → 立刻触发第②步重跑
  → 否则第③步校验失败
  → commit 被拒
  → 强制环路闭合
```

---

## 已知时效性问题

| 问题 | 滞后时间 |
|------|----------|
| 校验 JSON 快照 | **65 天** |
| 前端 dist/ | **7-8 天** |

⚠️ 任何"再跑一次"的延迟都会导致客户端看到陈旧数据。

---

## 相关文档

- [架构总览](ARCHITECTURE-OVERVIEW.md)
- [架构层详解](ARCHITECTURE-LAYERS.md)
- [闭合链路](../workflows/WORKFLOW-CLOSED-LOOP.md)
