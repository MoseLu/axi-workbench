---
id: axi-docs-zh-projects-dbskill
title: dbskill
type: project
status: draft
tags: [Axi Docs, 项目, shared, dbskill]
created: 2026-06-10
modified: 2026-06-10
graph-title: dbskill
graph-tags: [项目, shared]
description: dontbesilent 商业诊断工具箱 — 从 12,307 条推文提炼成 21 个 Agent skill，可在 Claude Code / Codex / Cursor / Trae Solo 等任意支持 skill / system prompt 的 Agent 上使用。
project:
  id: dbskill
  partition: shared
  path: /Volumes/code/workspace/shared/dbskill
  source-section: shared
  mirror-strategy: hand-curated
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md
---

# dbskill — 项目档案

> 工作区项目档案。真源：`/Volumes/code/workspace/shared/dbskill`。
> 分区：shared。
> **镜像策略**：手工维护。**不**走 `app/scripts/build-projects-index.mjs`，因为该项目不在 `WORKSPACE_INDEX.md` 表格中。

## 摘要

`dbskill` 是 dontbesilent 出品的商业诊断工具箱。它从 12,307 条推文里提炼方法论，做成 21 个 Agent skill，可在 Claude Code、Codex、Cursor、Trae Solo 等任意支持 skill / system prompt 的 Agent 上使用。

## 技术栈

- Skills：`SKILL.md` 风格的纯 markdown 包（无源代码）
- 知识库：JSONL 原子库（`知识库/原子库/atoms.jsonl`，~4,176 条）+ Markdown 知识包
- 辅助：`scripts/`、`tools/`、`LICENSE`、`VERSION`

## 权威文档

- 项目根目录：`/Volumes/code/workspace/shared/dbskill`
- 项目根 `README.md`：`/Volumes/code/workspace/shared/dbskill/README.md`（中文主）
- 项目根 `README.zh-CN.md`：`/Volumes/code/workspace/shared/dbskill/README.zh-CN.md`
- 上游 Releases：<https://github.com/dontbesilent2025/dbskill/releases>

## 备注

- 上游许可：CC BY-NC 4.0
- `axi-docs` 只镜像 2 份 README；不复制技能包与知识库内容

## 验证

- 纯内容项目；无构建 / 类型检查
- 消费方式：`npx -y skills add dontbesilent2025/dbskill -g --all`

## 跨引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费工作区索引
- `docs/content/{en,zh}/guide/routing.md` — 工作区项目路由
- `app/src/config/documentSources.ts` — Axi Docs 源注册

---

## 项目正文（镜像自 upstream `README.md`）

> 上游真源：`/Volumes/code/workspace/shared/dbskill/README.md`。
> 完整版包含安装、工具箱表、知识库结构、许可证等，**请直接读源**。
> 本档案只做"已镜像了哪些资源"的清单，避免双份维护导致漂移。

### 摘要（与 upstream 一致）

dontbesilent 商业诊断工具箱。从 12,307 条推文中提炼方法论，做成 21 个 Agent skill。

可在 Claude Code、Codex、Cursor、Trae Solo 等任意支持 skill / system prompt 的 Agent 上使用。

**最新更新：v2.14.2**

**v2.14.2 更新**：优化 `/dbs-chatroom` 的推荐人物规则。推荐专家时不再靠固定名单或泛名人直觉，改为先判断话题缺什么视角，再选择真正能推进讨论的人；同时明确排除泛财经、泛商业、靠表达和传播出名但判断密度偏弱的人。

**v2.14.1 更新**：修复 `/dbs-content-system` 发布包缺少 `scaffold/root/AGENTS.md`、`CLAUDE.md`、`SOURCE_OF_TRUTH.md` 的问题。

### 安装（节选）

#### Claude Code

```bash
claude plugin marketplace add dontbesilent2025/dbskill
claude plugin install dbs@dontbesilent-skills
```

#### 通用（Codex / Claude Code）

```bash
npx -y skills add dontbesilent2025/dbskill -g --all
```

#### Trae Solo

Trae Solo 一个 zip 装一个 skill。从 [GitHub Releases](https://github.com/dontbesilent2025/dbskill/releases) 下载最新的 `dbskill-版本号.zip`，解压后里面是 21 个独立的 skill zip（每个 zip 解压后根级是 `SKILL.md`），逐个拖进 Trae Solo 的「上传技能」窗口即可。

### 工具箱（21 个 skill 概览）

| Skill | 做什么 |
|---|---|
| `/dbs` | 主入口，自动路由 |
| `/dbs-diagnosis` | 商业模式诊断 |
| `/dbs-benchmark` | 对标分析 |
| `/dbs-content` | 内容创作诊断 |
| `/dbs-content-system` | 内容结构化系统 |
| `/dbs-hook` | 短视频开头优化 |
| `/dbs-xhs-title` | 小红书标题公式 |
| `/dbs-ai-check` | AI 写作特征识别 |
| `/dbs-slowisfast` | 慢就是快 |
| `/dbs-action` | 执行力诊断 |
| `/dbs-deconstruct` | 概念拆解 |
| `/dbs-goal` | 目标清晰化 |
| `/dbs-good-question` | 好问题生成器 |
| `/dbs-decision` | 个人决策系统 |
| `/dbs-learning` | 交互式学习 |
| `/dbs-save` | 状态存档 |
| `/dbs-restore` | 恢复上次 |
| `/dbs-report` | 报告输出 |
| `/dbs-agent-migration` | Agent 工作台迁移 |
| `/dbs-chatroom-austrian` | 奥派经济聊天室 |
| `/dbs-chatroom` | 定向聊天室 |

### 许可证

本项目采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可证。
