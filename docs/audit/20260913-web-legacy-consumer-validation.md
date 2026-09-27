# Web legacy consumer validation

> 日期：2026-09-13 · 状态：消费者验证完成，Web 活跃死消费者已清理

## 结论

审计初始确认 `apps/workbench` 的两个遗留布局文件是 `@epap/ui` 的唯一直接消费者，
但它们不在当前 `AxiDashboardShell` 的渲染链路中。它们使用的四个 legacy 公开符号
是：`Sidebar.tsx` 的 `Logo`、`SidebarMenu`，以及 `TabBar.tsx` 的 `IconButton`、
`TabItem`。本批次已删除这两个无活跃引用的文件及 CSS，并解除 Web 对 `@epap/ui`
的直接依赖；当前 Web 活跃壳只使用已接通的 `@axi/*` 运行时。

`@epap/api-client` 是独立的 API/业务合同兼容出口，不应与 legacy UI 迁移混做；它在
11 个生产页面和 1 个测试文件中被直接引用。`@epap/types` 与 `@epap/utils` 在
`apps/workbench/src` 没有直接源码引用，但仍是 Web 的声明依赖或 API client 的传递依赖，
不能仅凭零直接引用删除。

## 消费者矩阵

| 包/出口 | 当前消费者 | 当前用途 | 目标/处置 | 结论 |
| --- | --- | --- | --- | --- |
| `@epap/ui` | 无活跃 Web runtime consumer；历史消费者已在本批次删除 | legacy Logo、侧栏菜单、图标按钮类型和实现 | `AxiDashboardShell` 已提供活跃 Web 壳；兼容包仅保留作参考 | Web 依赖已移除，包本身暂保留 |
| `@epap/api-client` | 11 个生产页面 + `PersonalOs.test.tsx` | Control Plane、租户、Workflow API hooks/types | 先保持 API 合同稳定；与 UI 迁移解耦 | 非 UI legacy |
| `@epap/types` | 无 `apps/workbench/src` 直接引用 | API client/包级类型依赖 | 由 package graph 决定删除时机 | 未达到删除条件 |
| `@epap/utils` | 无 `apps/workbench/src` 直接引用 | Web 声明依赖/历史兼容出口 | 先做 package-level consumer check | 未达到删除条件 |

## 共享目标出口核对

- `@axi/core` exports：`AxiLogoMark`、`AxiIconButton`、`AxiSvgIcon`。
- `@axi/shell` exports：`AxiSidebarBrand`、`AxiSideMenu`、`AxiSideItem`、
  `AxiSideSubMenu`、`AxiTabbar`、`AxiRouteTabs`、`AxiRouteTab`。
- `@axi/*/styles.css` 由 Web `main.tsx` 直接加载；现有 Web 已经使用 shared shell、
  core、crud、settings、widgets 和 tokens，说明 provider link 与构建链已接通。
- shared `axi-ui` 仓库在本次审计前已有用户改动；本审计没有编辑或提交该 provider。

## 消费者验证证据

以下命令在当前 Workbench consumer 上通过：

- `pnpm --filter @axi/workbench type-check`
- `pnpm --filter @axi/workbench test`：38 个文件、184 个测试
- `node apps/workbench/scripts/verify-ui-contracts.mjs`
- `pnpm run build:workbench`：6 个 Turbo task 成功，包含 API/基础包与 Web 生产构建，
  不再拉入 `@epap/ui`
- `pnpm check:boundaries`
- `pnpm --filter @axi/workbench e2e`：25/25 浏览器验收通过，包含桌面壳、交接详情、
  登录/法律页和响应式边界

## 后续边界

如果未来恢复或新建独立的侧栏/Tab 组件，必须直接使用 `@axi/core`/`@axi/shell` 的
公开组合式出口，并为桌面信息架构、折叠/展开、键盘/tooltip、tab 关闭与导航行为
补充 Web 单测、UI contract、生产构建和浏览器验收。不得恢复 `@epap/ui` Web 依赖，
也不得把 `@epap/api-client` 改名为 UI 迁移的副作用或改变 Mobile 的独立组合。
