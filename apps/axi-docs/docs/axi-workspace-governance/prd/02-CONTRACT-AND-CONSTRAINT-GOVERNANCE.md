# 契约与约束治理：如何让改动复用已有能力，而不是各干各的（L1）

> 文档编号：PRD-02（契约治理）　层级：L1 产品线 / 工程治理
> 文档状态：Active　Owner：libu（solo owner）
> 创建：2026-09-25　最后更新：2026-09-25
> 上层：[`01-AxiomaticWorld-Personal-OS-PRD.md`](./01-AxiomaticWorld-Personal-OS-PRD.md)
> 规则元规范：[`00-PRD-SYSTEM-GUIDE.md`](./00-PRD-SYSTEM-GUIDE.md)
> 解决的问题：**改项目时 agent 不知道该复用什么，于是用 antd 把已有 @axi UI 的页面重写一遍；新项目/新功能没有统一约束，"各干各的"。**

---

## 1. 问题与根因诊断

典型故障：修改 `axi-workbench`，项目**早已引入并依赖 @axi UI**，但接手的 agent 不知道，于是：直接 `import { Table, Button } from 'antd'`、自己重定义样式，凭空造出第二套 UI。

根因不是"agent 笨"，而是约束**没有形成闭环**。审计现状（2026-09-25）：

| # | 缺口 | 后果 |
|---|---|---|
| 1 | `apps/workbench` **没有 ESLint 配置、没有 lint 脚本**（只有 type-check） | 写错 import 时编辑器不飘红、构建不报错 |
| 2 | **没有任何提交钩子**（无 husky / simple-git-hooks / lint-staged，`.git/hooks` 全是 sample） | 检查脚本不会自动跑，全凭自觉 |
| 3 | 唯一的 `check-axi-ui-adoption.mjs` **只扫 `apps/workbench/src/pages` 一个目录**，且要手动跑 | components、其他 app、新目录全部漏网 |
| 4 | **依赖层不守门**：package.json 仍允许新增 antd（workbench / devsvc-dashboard / resource-orchestration 现仍直接依赖 antd） | `pnpm add antd` 无人拦 |
| 5 | **没有"能力目录"**：agent 不知道"要表格/按钮/布局该用 @axi 的哪个组件" | 找不到现成的，就自己造 |
| 6 | 项目 AGENTS.md 没写硬性 UI 约束，也没固化"动手前先读 package.json + 相邻代码" | agent 默认从零写 |
| 7 | 新页面/项目不从带约束的模板生成 | 错误在第一步就埋下 |

**结论：契约（@axi/ui）和零散检查都存在，但缺少"可发现 → 实时拦截 → 依赖守门 → 提交门禁 → 模板固化"的端到端闭环。**

---

## 2. 解决总览：四道防线（纵深防御）

> 核心思想：**不要指望"文档提醒"能拦住 agent；要让"自由发挥"在写的时候、装依赖的时候、提交的时候连续失败。**

```text
防线1  契约可发现  → agent 动手前就知道"该用什么、不该用什么"
         能力目录 + AGENTS 硬规则 + 强制阅读顺序
防线2  实时拦截    → 写错的那一刻就失败（编辑器/构建）
         ESLint no-restricted-imports（禁止 antd，引导 @axi）
防线3  依赖守门    → 从源头禁止重复造轮子的依赖进入 package.json
         dependency-policy 检查（存量豁免、只减不增）
防线4  提交门禁+模板 → 错误进不了仓库；新建即正确
         .githooks/pre-commit + 统一 check-contracts + 页面/项目模板
```

任何一道防线被绕过，后面还有三道。**判断约束是否成功的标准：一个完全不了解背景的新 agent，在"写代码 / 装依赖 / 提交"三个动作上都会被自动引导或拦截。**

---

## 3. 硬性契约规则（Golden Rules，优先级最高）

适用于所有 Axi 前端项目（`apps/*-web`、`apps/workbench*`、React 表面）：

- **R1（单一 UI 表面）**：页面与组件**禁止直接 `import … from 'antd'` 或 `'@ant-design/icons'`**；UI 一律使用 `@axi/*` 组件。antd 只允许作为 `@axi/*` 包的**内部实现依赖**，不允许在业务页面直接出现。
- **R2（复用优先）**：实现任何 UI / 数据访问 / 契约类型前，先查 §4 能力目录与相邻现有代码；已有能力**必须复用，禁止重复实现**。
- **R3（依赖只减不增）**：业务 package.json 不得新增 antd / @ant-design/icons / 第二套 UI 库 / 重复的请求库；确需新增第三方依赖，必须在 PR/提交说明中写明"为什么 @axi 现有能力无法满足"。
- **R4（缺口回流，不绕过）**：当 @axi 没有所需组件时，**正确动作是扩展 @axi 对应包**（见 §8），而不是在业务页面就地引入 antd。
- **R5（契约唯一）**：跨项目类型 / API / 事件一律从 `@axi/workstation-contracts`、`@axi/api-client` 等契约包导入，禁止在业务代码里复制粘贴同名类型或手写 fetch URL。
- **R6（改动可追溯）**：修改边界、契约、依赖、对象模型属于高影响变化，按 `00` 宪章 §5 更新 PRD / 发 ADR，并跑 `workspace-project consumers <id>` 评估影响。

> 例外必须**显式登记**进 §5 豁免清单（含原因与到期/迁移条件），不允许"先写了再说"。

---

## 4. 能力目录 / 复用映射（Capability Catalog）

> 用法：**"我要一个 X" → 用右列的 @axi 组件**。这是 agent 动手前的必查表，也是 R2 的依据。
> 完整导出以各包 `src/index.ts` 为准；下表覆盖 90% 日常需求。

### 4.1 布局与外壳 → `@axi/shell`

| 我要… | 用 |
|---|---|
| 整页应用骨架（侧栏+头部+内容） | `AxiShell` / `AxiMainLayout` / `AxiDashboardShell` |
| 侧边栏、品牌区、菜单 | `AxiSidebar` `AxiSidebarBrand` `AxiSideMenu` `AxiSideItem` `AxiSideGroup(Title)` `AxiSideSubMenu` |
| 顶部栏、面包屑、内容容器 | `AxiHeaderBar` `AxiBreadcrumb` `AxiPageContent` `AxiScrollArea` |
| 多标签页 / 路由标签 | `AxiRouteTab(s)` `AxiTabbar` `AxiTabMenu` `AxiTabActionMenu` |
| 抽屉式菜单、双栏菜单 | `AxiMenuDrawer` `AxiMenuRight` `AxiDualMenu` |
| 全局搜索、快速入口 | `AxiGlobalSearch(Trigger)` `AxiFastEnter` |
| 消息 / 通知徽标与面板 | `AxiMessageBadge/Panel` `AxiNotificationBadge/Panel` `AxiStatusPill` |
| 语言 / 主题切换 | `AxiLocaleSwitcher` `AxiThemeSwitcher` |
| 悬浮工具坞 | `AxiFloatingToolDock` |

### 4.2 增删改查 / 表格 / 表单 → `@axi/crud`

| 我要… | 用 |
|---|---|
| 完整 CRUD 页面 / 布局 | `AxiCrud` `AxiCrudLayout` `AxiCrudRow` |
| 表格（含列定义/分组/表头/行操作） | `AxiTable` `AxiCrudTable` `AxiTableGroup` `AxiTableHeader` `AxiTableActions`（列类型 `AxiTableColumn`） |
| 新建/编辑/详情弹窗 | `AxiDialog` `AxiDialogGroup` `AxiForm` `AxiFormLayout` |
| 搜索 / 筛选 / 高级查询 | `AxiSearch` `AxiSearchBar` `AxiAdvSearch` `AxiFilterGroup` `AxiFilterList` `AxiSearchKey` |
| 分页 | `AxiPagination` |
| 增/改/删/批量删/刷新/更多 按钮 | `AxiAddButton` `AxiEditButton` `AxiDeleteButton` `AxiMultiDeleteButton` `AxiBatchDeleteButton` `AxiRefreshButton` `AxiMoreButton` `AxiInfoButton` `AxiTableButton` `AxiPopoverMenu` |
| 主从列表 / 选择表 / 开关 | `AxiMasterList` `AxiSelectTable` `AxiSwitch` |
| 异常 / 结果 / 锁屏页 | `AxiExceptionPage` `AxiResultPage` `AxiScreenLock` |

### 4.3 基础原子 → `@axi/core`

| 我要… | 用 |
|---|---|
| 主题 / 外观（含 antd 主题桥接） | `AxiThemeProvider` `useAxiTheme` `applyAxiTheme` `createAxiAntdTheme` |
| SVG 图标（含图标名类型） | `AxiSvgIcon`（`AxiIconName`）、`admin-icons` |
| 图标按钮、卡片、标签 | `AxiIconButton`、`cards.*`、`AxiTag` |
| 品牌标识、水印、回到顶部、数字滚动 | `branding.*` `watermark.*` `back-to-top.*` `count-to.*` |
| 右键菜单、反馈、文本滚动 | `context-menu.*` `feedback.*` `text-scroll.*` |
| 通用 hooks、宿主应用、插件 | `hooks.*` `hosted-app.*` `plugins.*` |

### 4.4 业务控件 / 设置 / 样式预设 / 数据与契约

| 我要… | 用 |
|---|---|
| 横幅、业务管理控件 | `@axi/widgets`：`AxiBanner`、`controls.*`、`management.*` |
| 设置面板 | `@axi/settings` |
| 插件 / 扩展 | `@axi/addons` |
| 样式预设（主题变量） | `@axi/presets`：`axiStylePresets` `resolveAxiStylePresetVariables` |
| 多语言 Provider、网关 URL、Shell 事件 | `@axi/workbench-foundation`：`WorkbenchLocaleProvider` `resolveGatewayURL` `SHELL_EVENTS`；图标 `@axi/workbench-foundation/icons` |
| 控制面数据请求 / hooks | `@axi/api-client`：`useControlSnapshot` 等 |
| 跨项目类型（治理/工作流/契约） | `@axi/workstation-contracts`（Governance*、WorkflowEngine* 等类型） |

---

## 5. 存量豁免清单（Exemptions，只减不增）

> 这些位置当前仍直接依赖 / 使用 antd，属于**历史存量**，被显式豁免；不得新增同类用法，迁移完成后从本表删除。

| 位置 | 现状 | 豁免原因 / 迁移条件 |
|---|---|---|
| `apps/workbench`（package.json 含 antd、@ant-design/icons） | 依赖存在，但页面 import 已被 adoption 检查约束 | 旧页面隔离（见下）；待页面全部迁移后移除依赖 |
| `apps/workbench/src/pages` 旧页面（24 个，见 adoption 脚本 `quarantinedPageFiles`） | 已被路由表隔离为 `AxiExceptionPage`（404），不可达 | 迁移到 @axi 表面后解除隔离 |
| `apps/devsvc-dashboard`（package.json 含 antd） | 直接依赖 antd | 存量控制台；后续收敛为 @axi 后移除 |
| `apps/resource-orchestration`（package.json 含 antd） | 直接依赖 antd | 存量；后续收敛为 @axi 后移除 |
| `pages/Login.tsx` | 独立认证表面 | 有意豁免于 CRUD 页面契约 |

> 新增豁免 = 高影响决策，需在本表登记原因与"何时偿还"，并在 `docs/state` 留痕。

---

## 6. 四道防线的落地映射

| 防线 | 落地物 | 触发时机 |
|---|---|---|
| 1 可发现 | 本文件（能力目录）+ 项目 `AGENTS.md` 硬规则 + §7 强制阅读顺序 | agent 接手 / 动手前 |
| 2 实时拦截 | 根 `eslint.config.mjs` 的 `no-restricted-imports`（禁 antd / @ant-design/icons，引导 @axi） | 编辑器实时、`pnpm lint`、构建 |
| 3 依赖守门 | `scripts/check-dependency-policy.mjs`（对照 §5 豁免，检测违规新增） | 提交前、CI |
| 4 提交门禁 + 模板 | `.githooks/pre-commit`（经 `core.hooksPath`）→ `scripts/check-contracts.mjs`；页面/项目模板 | `git commit`；新建项目/页面 |

### 6.1 统一门禁 `check-contracts.mjs`

聚合三项检查，任一失败即阻断：
1. UI import 检查（全仓 src，禁 antd，豁免按 §5）。
2. 依赖策略检查（package.json 不得违规新增 antd）。
3. 既有边界检查 `check-workbench-boundaries.mjs`。

调用方式：
```bash
node scripts/check-contracts.mjs        # 提交前 / CI 一键门禁
pnpm check:contracts                    # 同（package.json script）
```

### 6.2 pre-commit（零依赖，git 原生）

不引入 husky/lint-staged（当前未安装），改用版本化钩子目录：
```bash
git config core.hooksPath .githooks     # 一次启用，随仓库走、零安装
```
`.githooks/pre-commit` 在提交时自动运行 `node scripts/check-contracts.mjs`；失败则提交被拒绝。

> 说明：`core.hooksPath` 是本地 git 配置，克隆后需重新执行一次启用命令（已写入项目 AGENTS / onboarding）。solo 本地场景这是最轻量可靠的方案。

---

## 7. agent 动手前的强制阅读顺序（固化到 AGENTS）

在任何前端改动**写第一行代码之前**，按序确认：

1. 目标项目根 `AGENTS.md`（边界 / 硬规则 / 验证命令）。
2. 目标项目 `package.json`：**已依赖哪些 @axi 包**（这是"之前引入过"的事实源）。
3. 本文 §4 能力目录：所需 UI / 数据 / 类型对应哪个 @axi 组件。
4. **相邻现有代码**：同类页面/组件是怎么用 @axi 实现的（直接参照，不另起炉灶）。
5. 跨项目影响：`workspace-project consumers <id>`；改契约/边界先发 ADR。

> 反模式（禁止）：跳过 package.json 与相邻代码，直接用 antd / 自己写样式 / 复制类型 / 手写请求。

---

## 8. 当 @axi 没有我要的组件（缺口回流流程）

按 R4，**不要绕过，要回流**：

1. 确认能力目录与相邻代码确实没有等价能力。
2. 判断归属：通用原子 → `@axi/core`；布局/导航 → `@axi/shell`；CRUD/表格/表单 → `@axi/crud`；业务控件 → `@axi/widgets`。
3. 在对应 @axi 包中实现并从 `src/index.ts` 导出，补测试。
4. 发布/构建该包（本地 registry 见 `@axi/registry`），业务项目再升级依赖使用。
5. 在本文 §4 能力目录登记新组件。
6. 若这是个有取舍的设计，补一条 ADR。

**禁止**：以"@axi 没有"为由，在业务页面直接引入 antd 实现。

---

## 9. 新建项目 / 页面的标准流程（让正确成为默认）

- **新项目**：先走工作区 `route-intent` 准入（见根 AGENTS）；从模板创建，模板**自带**：正确的 @axi 依赖、根 `eslint.config.mjs`、`check-contracts` 门禁、`core.hooksPath` 启用说明、AGENTS 硬规则。
- **新页面**：复制页面模板/参照现有合规页面；默认 import 来自 @axi；路由在路由表登记。
- 模板职责：把 §3 规则与 §6 门禁"出厂即装好"，agent 不需要记住约定，模板替它记住。

---

## 10. Definition of Done（一次改动完成的验收清单）

- [ ] 没有新增直接 antd / @ant-design/icons 的 import（ESLint 通过）。
- [ ] 复用了已有的 @axi 能力；没有重复组件 / 重复类型 / 重复请求逻辑。
- [ ] package.json 未违规新增依赖；如确需，已写明理由；豁免已登记 §5。
- [ ] 缺口能力已回流到 @axi 并导出、登记能力目录。
- [ ] `node scripts/check-contracts.mjs` 通过；type-check / 测试通过。
- [ ] 触及边界 / 契约 / Schema 已更新 PRD / 发 ADR、评估消费者。
- [ ] HANDOFF / CHANGELOG 已更新。

---

## 11. 变更记录

| 日期 | 变更 | Owner |
|---|---|---|
| 2026-09-25 | 首版：诊断七项缺口，确立四道防线、Golden Rules、能力目录、豁免清单、缺口回流与 DoD | libu |
