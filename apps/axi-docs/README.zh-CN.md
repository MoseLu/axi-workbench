# Axi Docs

Axi Docs 是面向 Axi 项目的 workspace 文档枢纽。它把 Vite React 阅读器、本地知识源适配器与 MCP 文档总线组合在一起，让人和 agent 都能检视同一份项目、技能和 workspace 文档面。

## 范围

- `app/` 持有 React/Vite 应用、MCP server、源适配器、测试与构建流水线。
- `plans/` 是给 agent 在当前目录下快速识别规划分类的根级入口。
- `docs/content/en/` 与 `docs/content/zh/` 持有由应用渲染的产品文档页面，包括 `guide/`、`plans/` 与 `projects/`。
- `docs/content/{en,zh}/plans/` 是长期“想法到落地”方案的权威来源；Axi Todo 负责执行状态和下一步动作。
- `docs/axi-workspace-governance/` 是 workspace 治理文档的本地镜像；以 workspace 治理仓库为权威源。
- `docs/project-docs.manifest.json` 记录项目文档契约。
- `.claude/PARADIGM.md` 与 `.claude/ARCHITECTURE.md` 定义项目级 deep-init 契约。

## 验证

```bash
pnpm --dir app docs:check
pnpm --dir app source:check
pnpm --dir app verify
```

在针对实现做局部修改时使用 `pnpm --dir app test:run`，在声明 UI 或打包就绪前使用 `pnpm --dir app build`。

## 源边界

Axi Skills 通过 `docs/sources.lock.json` 接入，而不是 git submodule。Workspace 项目元数据通过 `/Volumes/code/workspace/WORKSPACE_INDEX.md` 与 `/Volumes/code/workspace/workspace.graph.json` 接入。

<!-- MANUAL: keep this README as the short project entrypoint; put implementation details in app/README.md and app/AGENTS.md. -->
