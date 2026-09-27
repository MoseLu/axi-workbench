# CLAUDE.md

## 项目概述

Axi Docs 是 Axi 项目的文档中心，基于 Vite React 构建的阅读器应用，集成本地知识源适配器与 MCP 文档总线，供人类和 AI agent 检查相同的项目、技能和工作区文档。

## 核心目录

- `app/` — React/Vite 应用核心，包含 MCP server、源码适配器、测试和构建管道
- `docs/content/{en,zh}/` — 产品文档页面（guide、plans、projects）
- `plans/` — 代理检查当前目录的根级计划入口点
- `todo/` — 任务追踪

## 详细文档

项目级深度初始化合约位于：
- `.claude/PARADIGM.md` — 范式指南
- `.claude/ARCHITECTURE.md` — 架构说明

## 验证命令

```bash
pnpm --dir app docs:check  # 文档检查
pnpm --dir app verify      # 验证构建
```

## 技术栈

- Vite + React
- TypeScript
- MCP Server
