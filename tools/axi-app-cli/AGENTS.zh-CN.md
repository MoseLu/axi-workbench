# Axi App CLI Agent Notes
Last updated: 2026-04-03 16:20:58 +08:00

## 仓库概要

- 请把本仓库视为脚手架工作区（scaffolder workspace），而不是生成出来的应用本体。
- 仓库本身是一个 `pnpm workspace` monorepo，核心是 `apps/cli`、共享的脚手架包、基础包与功能包。
- 保留生成项目的默认契约：`Vite + React + TypeScript + Zod`、Flask、Style Dictionary、SCSS、基于特性（feature-based）的目录布局、Git hooks、PRD/TDD 文档以及 80% 覆盖率门槛。

## 工作区结构

- `apps/cli`：CLI 入口与发布目标。
- `packages/scaffold-kit`：工作区包之间共享的契约与辅助函数。
- `packages/scaffold-registry`：模块注册表与预设（preset）策略装配。
- `packages/scaffold-runtime`：命令运行时、sync/doctor/install 流水线与文件编排。
- `packages/foundation-web`：Web 外壳与品牌相关的基础模块。
- `packages/foundation-api`：Flask 基线与示例 API 基础模块。
- `packages/foundation-design`：token 包与 Style Dictionary 基础模块。
- `packages/foundation-ops`：工作区 bootstrap、治理、文档与资源相关基础模块。
- `packages/feature-*`：可安装的扩展族，按职责拆分为独立的工作区包。

## CLI 公共面

- 公共 CLI 面以 `axi init`、`create-axi-app <name>`、`axi add`、`axi sync`、`axi list`、`axi doctor` 为核心。
- 保持 `list --json`、`doctor --json`、`doctor --fix` 稳定，便于自动化与契约测试。

## 工作约定

- 优先使用确定性模板与薄编排代码，避免隐藏在背后的"魔法"。
- 新增或修改生成文件应通过模板层进行，让测试能断言完整项目形态。
- 把 `.axi/modules.json` 视为可编辑的模块策略，把 `.axi/scaffold.manifest.json` 视为已应用快照。
- 保持文档、运行时行为与预设策略一致，让生成出的应用可解释、可修复。
- 严格守住包之间的边界：`foundation-*` 与 `feature-*` 只能依赖 `@axi/scaffold-kit`；`scaffold-registry` 是唯一的装配层；`scaffold-runtime` 是唯一的执行层；`apps/cli` 只能依赖 `@axi/scaffold-runtime`。
- 在新增或调整工作区包时，将 `docs/architecture/capability-package-standard.md`、`docs/architecture/package-boundaries.md`、`pnpm capabilities:check`、`pnpm workspace:check` 视为硬性约束。
- 新建工作区包请使用 `pnpm package:new -- --kind <...> --name <...>` 引导，不要手工复制老目录。
- 本工作区位于一个会忽略 `projects/*` 的父级治理仓库下，因此除非本项目获得自己的 git 根目录，否则仓库概要工具必须回退到基于文件系统的变更检测。

## 当前重点

- 围绕运行时命令类、生命周期阶段、类型化的贡献（typed contributions）以及 CLI bootstrap 边界，持续推进 `v1.0 Hardening` 工作。
- 让 monorepo 的包拆分在产品文档、架构文档与生成的治理文件中保持一致。
- `docs/` 用来承载架构 / 产品 / 研究材料，`docs/todo/` 用来承载汇总到根任务列表的子 TODO 计划。

## 近期同步记录

- 包边界相关工作已写入 `docs/architecture/package-boundaries.md`，并由 `pnpm boundaries:check` 强制执行。
- capability-package 编写规则已写入 `docs/architecture/capability-package-standard.md`、各本地包 `README.md`，并由 `pnpm capabilities:check` 强制执行。
- `scripts/new-workspace-package.mjs` 与 `pnpm package:new` 现在为新应用、契约、编排、基础与功能包提供了仓库原生的 bootstrap 路径。
- 最近的脚手架工作还在 `feature-ui` 中新增了若干基础 UI 原子，如 `Alert`、`Modal`、`Drawer`、`Progress`、`Tabs`、`Tooltip`、`Skeleton`、`FormField`。
