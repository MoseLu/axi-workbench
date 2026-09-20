---
id: reference-workspace-architecture-change-triggers
title: Axi 工作区修改触发链路
type: reference
status: evergreen
tags: [workspace, architecture, change-triggers, governance]
created: 2026-08-22
modified: 2026-08-22
agent-readable: true
---

# Axi 工作区修改触发链路

> 来源：[`.workspace/reports/workspace-doc-audit.html`](workspace-doc-audit.html) · v5 · 2026-08-21

## 链路图

```
修改源文件 → 触发什么 → 看到效果的地方
```

---

## ① 修改源文件

| 修改类型 | 说明 |
|----------|------|
| 改根规则 | `/Volumes/code/workspace/AGENTS.md` |
| 改规则条目 | `/Volumes/code/workspace/projects/axi-rules/` |
| 改 ADR | `/Volumes/code/workspace/projects/axi-rules/rules/` |
| 改共享包 | `/Volumes/code/workspace/shared/` |
| 改前端代码 | `/Volumes/code/workspace/projects/*/app/` |
| 改注册表 | `/Volumes/code/workspace/infra/axi-workspace-governance/` |

---

## ② 触发什么

| 触发结果 | 说明 |
|----------|------|
| ✅ 重跑文档同步器 | 同步到 `axi-docs` |
| ✅ 重跑适配器扇出 | 4 个 CLI 的 AGENTS 镜像 |
| 重算完成度 | `project-completion.json` |
| 重算交接 | `project-handoff.json` |
| 校验失败则 commit 阻塞 | `workspace-project validate` |

---

## ③ 看到效果的地方

| 产出 | 说明 |
|------|------|
| ✅ 9 份渲染文档 | Markdown → HTML |
| ✅ 3 个 JSON 快照 | 完成度 / 交接 / 校验 |
| ✅ 4 CLI 指令镜像 | Claude / Codex / Gemini / OpenCode |
| ✅ 前端镜像 | `dist/` 构建产物 |
| CodeGraph 索引 | 代码知识图谱 |

---

## 时效性陷阱 ⚠️

| 问题 | 滞后时间 | 影响 |
|------|----------|------|
| 校验 JSON 快照 | **65 天** | 客户端看到过期验证状态 |
| 前端 dist/ | **7-8 天** | 前端显示陈旧数据 |

**任何"再跑一次"的延迟都会导致客户端看到陈旧数据。**

---

## 修复建议

```bash
# 强制刷新所有生成产物
cd /Volumes/code/workspace/infra/axi-workspace-governance
pnpm workspace:docs:sync
node scripts/workspace-project-cli.mjs validate
node scripts/workspace-audit.mjs
```

---

## 相关文档

- [架构总览](ARCHITECTURE-OVERVIEW.md)
- [数据流转](ARCHITECTURE-DATA-FLOW.md)
- [闭合链路](../workflows/WORKFLOW-CLOSED-LOOP.md)
