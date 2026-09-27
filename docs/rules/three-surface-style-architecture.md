# 三端样式架构规则

适用范围：Workbench Web、Workbench Mobile、Workbench Desktop，以及它们直接消费的 `packages/ui`。

## 所有权

- `@axi/tokens` 是颜色、间距、字号、圆角、阴影、控件尺寸和主题的唯一源头。
- `packages/ui` 拥有可跨端复用的基础控件；组件样式必须与组件实现同目录。
- Web 页面样式只拥有页面组合和 Web 布局。
- Mobile 只拥有安全区、触控尺寸、底部导航、扫码和微信适配。
- Desktop 只拥有 Tauri 窗口、标题栏、拖拽区和桌面密度差异。

## 命名与兼容

新样式统一使用 `--axi-*` 语义 token。`--mpms-*`、`--primary`、`--wb-*` 等旧命名只能作为兼容别名，不能新增定义。

兼容别名必须指向 `--axi-*`，并在迁移完成后删除。端内 token 只能表达平台差异，不能复制共享基础值。

## Token 层级

样式冲突必须沿 token 层级解决，不得使用 `!important`：

1. **Primitive**：原始颜色、尺寸、字号，只能由 `@axi/tokens` 定义。
2. **Semantic foundation**：页面背景、文本、边框、状态色和控件尺寸，统一使用 `--axi-*`。
3. **Component**：组件内部状态通过 `--axi-component-*` token 定义默认值和状态值。
4. **Surface**：Web、Mobile、Desktop 只通过 `--axi-surface-*` 表达平台密度、布局和交互差异。
5. **Page**：页面只允许定义 `--axi-page-*` 局部组合值，不得重新定义 foundation 或 primitive。
6. **Vendor**：第三方库适配放在隔离的 vendor 文件和作用域内，只通过适配 token 改变视觉值。

覆盖顺序由 CSS 加载顺序、作用域和 cascade layer 控制；新增规则必须明确属于上述哪一层。

## 全局样式

全局入口只允许包含 reset、token、主题、字体和平台基础规则。组件级选择器、页面级布局和第三方覆盖必须放在对应组件、页面或 `vendor-overrides` 文件中。

禁止新增或保留 `!important`。业务样式不得用强制覆盖修复组件 API、主题或加载顺序问题。

## 检查

运行 `pnpm check:styles` 获取当前基线；该命令会在发现 `!important` 时失败。`--strict` 还会阻止重复 token。该检查是结构门禁，不替代浏览器中的主题、响应式和三端行为验证。
