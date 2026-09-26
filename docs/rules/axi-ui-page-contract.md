# Workbench Axi UI 页面契约

Workbench 页面一旦进入 Axi UI 页面域，就只能使用 Axi UI 公开的页面、布局、CRUD、反馈和标签组件。页面代码不得再建立第二套组件或样式语义。

## 硬约束

- 页面不得直接导入 `antd` 或 `@ant-design/icons`。
- CRUD 页面必须使用 `AxiCrudLayout` / `DesktopCrudFrame`、`AxiTable` / `AxiCrudTable`、`AxiTableGroup`、`AxiTag` 等 Axi 组件。
- 表格不得依赖 Ant Design 默认边框、文字颜色或分页样式；这些由 `@axi/crud` 的 Token 契约提供。
- 页面 CSS 不得重新定义颜色、间距或组件状态语义；必须使用 Axi Token 和组件变体。
- `bordered={false}` 等逃生口必须有明确的 Axi UI 设计决策和审计记录。

## 执行方式

`pnpm check:axi-ui` 会检查 Workbench 全部页面目录，且已接入 `pnpm verify:ci`。现有页面中的直接 Ant Design 依赖只作为迁移基线保留在检查器的有限白名单中；白名单不是新页面许可，也不得复制遗留实现。

迁移一个遗留页面后，必须同时删除检查器白名单项，并运行 Workbench 类型检查、Axi UI 采用检查和桌面/浏览器验证。
