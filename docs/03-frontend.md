# 第三章 前端层详细设计

> 说明：本文保留前端设计与迁移背景；其中早期应用名称和目录示例可能已过时。当前物理源码拓扑以 [`architecture/source-catalog.md`](./architecture/source-catalog.md) 为准。

## 3.1 工作空间组织 — Turborepo + PNPM

### 3.1.1 pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3.1.2 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "API_BASE_URL", "VITE_API_URL"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "gen": {
      "cache": false
    },
    "storybook": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 3.1.3 包依赖关系

```
apps/web-portal        ──► packages/ui-components, schemas, api-client, types, utils
apps/admin-dashboard   ──► packages/ui-components, schemas, api-client, types, utils
apps/mobile-app        ──► packages/schemas, types, utils
apps/design-system     ──► packages/ui-components, types
packages/api-client    ──► packages/types, schemas
packages/ui-components ──► packages/types
packages/schemas       ──► (仅依赖 zod)
packages/types         ──► (无内部依赖)
packages/utils         ──► (无内部依赖)
```

---

## 3.2 packages/schemas — Zod Schema 共享层

> **核心价值**：同一份 Zod Schema 同时用于前端表单验证、API 类型推断、生成 JSON Schema 供后端校验、生成 Mock 数据。

### 目录结构

```
packages/schemas/
├── src/
│   ├── common/
│   │   ├── pagination.ts     # PaginationSchema, PaginationQuerySchema
│   │   ├── sort.ts           # SortSchema, SortOrderEnum
│   │   ├── response.ts       # ApiResponseSchema<T>, PaginatedResponseSchema<T>
│   │   ├── errors.ts         # ErrorResponseSchema, ValidationErrorSchema
│   │   └── id.ts             # UUIDSchema, IdSchema
│   ├── entities/
│   │   ├── user.ts           # UserSchema, UserRoleEnum, UserStatusEnum
│   │   ├── project.ts        # ProjectSchema, ProjectStatusEnum
│   │   ├── task.ts           # TaskSchema, TaskStatusEnum, TaskPriorityEnum
│   │   ├── workflow.ts       # WorkflowDefSchema, WorkflowInstanceSchema, StepSchema
│   │   ├── file.ts           # FileMetaSchema, UploadSchema
│   │   ├── notification.ts   # NotificationSchema, NotificationTypeEnum
│   │   └── tag.ts            # TagSchema
│   ├── requests/
│   │   ├── auth.ts           # LoginInput, RegisterInput, RefreshTokenInput
│   │   ├── project.ts        # CreateProjectInput, UpdateProjectInput
│   │   ├── task.ts           # CreateTaskInput, UpdateTaskInput, AssignTaskInput
│   │   ├── workflow.ts       # CreateWorkflowInput, TriggerWorkflowInput
│   │   └── search.ts         # KBSearchInput, AgentChatInput
│   ├── responses/
│   │   ├── auth.ts           # TokenResponse, UserResponse
│   │   ├── project.ts        # ProjectResponse, ProjectListResponse
│   │   ├── workflow.ts       # WorkflowResponse, InstanceResponse
│   │   └── kb.ts             # SearchResultResponse, DocumentChunkResponse
│   └── index.ts
├── scripts/
│   └── gen-json-schema.ts    # 生成 JSON Schema 供后端使用
├── package.json              # name: @eap/schemas
└── tsconfig.json
```

### 示例 Schema 定义

```typescript
// src/entities/project.ts
import { z } from "zod"

export const ProjectStatusEnum = z.enum(["active", "archived", "draft", "completed"])

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  status: ProjectStatusEnum,
  ownerId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Project = z.infer<typeof ProjectSchema>

// src/requests/project.ts
export const CreateProjectInput = ProjectSchema.omit({
  id: true, createdAt: true, updatedAt: true
})

export const UpdateProjectInput = CreateProjectInput.partial()

export type CreateProjectInput = z.infer<typeof CreateProjectInput>
```

---

## 3.3 packages/types — 跨项目类型定义

```
packages/types/src/
├── api.ts        # ApiResponse<T>, PaginatedResponse<T>, ApiError, RequestStatus
├── auth.ts       # UserRole, Permission, AuthContext, JWTPayload
├── events.ts     # 前端事件总线类型定义
├── theme.ts      # 主题 Token 类型 (ColorToken, SpaceToken, TypographyToken)
├── route.ts      # RouteConfig, RouteMetadata (权限/面包屑)
├── upload.ts     # FileUploadState, UploadProgress, UploadError
├── sse.ts        # SSEMessage, AgentStreamEvent, StreamStatus
└── index.ts
```

---

## 3.4 packages/utils — 工具函数库

```
packages/utils/src/
├── cn.ts          # clsx + twMerge 组合 (条件 CSS 类名)
├── date.ts        # 日期格式化、相对时间 (dayjs 封装)
├── string.ts      # truncate, slugify, capitalize, maskEmail
├── url.ts         # URL 拼接、参数序列化/解析、安全跳转检查
├── storage.ts     # localStorage/sessionStorage 安全封装 (含 JSON 序列化)
├── array.ts       # groupBy, unique, chunk, flatten, sortBy
├── object.ts      # pick, omit, deepMerge, isEmpty
├── error.ts       # 从 API 响应中提取错误信息
├── async.ts       # retry(带指数退避), debounce, throttle, sleep
├── crypto.ts      # 浏览器端 UUID 生成、SHA-256 哈希
└── index.ts
```

---

## 3.5 packages/ui-components — 基础组件库

### 技术选型

- **Radix UI Primitives** — 无样式、可访问性优先的原语组件
- **Tailwind CSS** — Utility-first 样式系统
- **class-variance-authority (cva)** — 类型安全的组件变体管理

### 目录结构

```
packages/ui-components/src/
├── primitives/
│   ├── Button.tsx           # variant: default/outline/ghost/destructive, size: sm/md/lg
│   ├── Input.tsx            # 含 error state、left/right addon、clearable
│   ├── Select.tsx           # 基于 Radix UI Select，支持搜索
│   ├── Checkbox.tsx         # 基于 Radix UI Checkbox
│   ├── Switch.tsx           # 基于 Radix UI Switch
│   ├── RadioGroup.tsx       # 基于 Radix UI RadioGroup
│   ├── Textarea.tsx         # 自动高度调整 (autosize)
│   ├── Badge.tsx            # status: default/success/warning/error/info
│   ├── Avatar.tsx           # 含 fallback (首字母)、尺寸变体
│   ├── Tooltip.tsx          # 基于 Radix UI Tooltip
│   ├── Dialog.tsx           # 基于 Radix UI Dialog，含 confirm 变体
│   ├── Drawer.tsx           # 侧边抽屉面板
│   ├── Dropdown.tsx         # 下拉菜单，基于 Radix UI DropdownMenu
│   ├── Tabs.tsx             # 基于 Radix UI Tabs
│   ├── Accordion.tsx        # 折叠面板
│   ├── Progress.tsx         # 线形/环形进度条
│   └── Skeleton.tsx         # 骨架屏占位
├── composed/
│   ├── DataTable.tsx        # 支持排序/过滤/分页/行选择/虚拟滚动
│   ├── Form.tsx             # 基于 React Hook Form 封装
│   ├── FormField.tsx        # 表单字段容器（含 label、描述、error）
│   ├── SearchInput.tsx      # 防抖搜索框（可配置延迟）
│   ├── FileUpload.tsx       # 拖拽上传 + 进度显示 + 文件预览
│   ├── DatePicker.tsx       # 日期/时间范围选择器
│   ├── Pagination.tsx       # 含页码跳转和每页条数
│   ├── EmptyState.tsx       # 空状态（含图标、标题、操作按钮）
│   ├── ConfirmDialog.tsx    # 确认对话框（封装 Dialog）
│   └── ErrorBoundary.tsx    # 错误边界（含降级 UI）
├── feedback/
│   ├── Toast.tsx            # 基于 Radix UI Toast，自动消失
│   ├── Alert.tsx            # 行内提示框（success/warning/error/info）
│   └── Loading.tsx          # 全屏 Loading overlay
├── layouts/
│   ├── Shell.tsx            # 应用外层布局（sidebar + header + content）
│   ├── Sidebar.tsx          # 侧边导航（支持折叠、多级菜单）
│   ├── PageHeader.tsx       # 页面标题区域（含面包屑、操作按钮）
│   └── Card.tsx             # 内容卡片容器
├── hooks/
│   ├── useDisclosure.ts     # Modal/Drawer 开关状态管理
│   ├── useBreakpoint.ts     # 响应式断点检测
│   ├── useClickOutside.ts   # 点击外部关闭
│   └── useCopyToClipboard.ts
└── index.ts
```

---

## 3.6 packages/api-client — 自动生成 API 客户端

```
packages/api-client/src/
├── client.ts              # Axios 实例（baseURL、超时、拦截器）
├── interceptors/
│   ├── auth.ts            # 401 自动刷新 Token 逻辑（防并发）
│   └── error.ts           # 统一错误格式化
├── generated/             # ⚠️ 自动生成，勿手动修改
│   ├── gateway/           # 网关 API (openapi-generator)
│   ├── core/              # 核心服务 API
│   ├── workflow/          # 工作流 API
│   ├── kb/                # 知识库 API
│   └── agent/             # Agent API
├── hooks/                 # TanStack Query 封装
│   ├── useAuth.ts         # 登录/注销/用户信息
│   ├── useProjects.ts     # 项目 CRUD + 列表
│   ├── useTasks.ts        # 任务 CRUD + 看板数据
│   ├── useWorkflows.ts    # 工作流管理
│   ├── useKnowledge.ts    # 知识库搜索
│   ├── useAgentChat.ts    # Agent 对话（SSE 流式）
│   └── useFiles.ts        # 文件上传/下载
├── query-keys.ts          # 统一 Query Key 工厂函数
├── mock/
│   ├── handlers.ts        # MSW mock handlers
│   └── fixtures/          # 各接口 fixture 数据
└── index.ts
```

---

## 3.7 apps/web-portal — 主控制台

### 技术栈

| 类别 | 方案 |
|------|------|
| 框架 | React 18 + TypeScript 5.x |
| 构建 | Vite 5 |
| 路由 | React Router v6（Data Router 模式） |
| 全局状态 | Zustand |
| 服务端状态 | TanStack Query v5 |
| 样式 | Tailwind CSS + CSS Modules（局部） |
| UI | @eap/ui-components + Radix UI |
| 表单 | React Hook Form + @eap/schemas (Zod) |
| 图表 | Recharts |
| 拖拽 | dnd-kit |
| 测试 | Vitest + React Testing Library + Playwright |

### 目录结构

```
apps/web-portal/
├── src/
│   ├── app/
│   │   ├── router.tsx          # React Router v6 路由定义（含懒加载）
│   │   ├── providers.tsx       # 全局 Provider 树 (QueryClient, Router, Auth, Toast)
│   │   └── layout/
│   │       ├── Shell.tsx       # 应用外层布局
│   │       ├── Sidebar.tsx     # 侧边导航（多级菜单，折叠）
│   │       └── Topbar.tsx      # 顶部栏（通知铃铛、用户头像菜单）
│   ├── features/
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   └── ForgotPasswordPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx       # RHF + Zod 验证
│   │   │   │   └── OAuthButtons.tsx    # GitHub / Google
│   │   │   ├── store/
│   │   │   │   └── authStore.ts        # Zustand
│   │   │   └── index.ts
│   │   ├── projects/
│   │   │   ├── pages/
│   │   │   │   ├── ProjectListPage.tsx
│   │   │   │   └── ProjectDetailPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── ProjectForm.tsx
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   └── ProjectFilter.tsx
│   │   │   └── index.ts
│   │   ├── tasks/
│   │   │   ├── pages/
│   │   │   │   ├── TaskBoardPage.tsx   # 看板视图（dnd-kit）
│   │   │   │   └── TaskListPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── TaskCard.tsx        # 可拖拽
│   │   │   │   ├── TaskForm.tsx
│   │   │   │   └── TaskColumn.tsx      # 看板列
│   │   │   └── index.ts
│   │   ├── workflows/
│   │   │   ├── pages/
│   │   │   │   ├── WorkflowListPage.tsx
│   │   │   │   └── WorkflowDetailPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── WorkflowDiagram.tsx # DAG 可视化 (ReactFlow)
│   │   │   │   └── WorkflowForm.tsx
│   │   │   └── index.ts
│   │   ├── knowledge/
│   │   │   ├── pages/
│   │   │   │   └── KnowledgeSearchPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── SearchResultCard.tsx
│   │   │   │   └── DocumentPreview.tsx
│   │   │   └── index.ts
│   │   ├── agents/
│   │   │   ├── pages/
│   │   │   │   └── AgentChatPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── ChatMessage.tsx     # Markdown 渲染 + 代码高亮
│   │   │   │   ├── ChatInput.tsx       # 支持文件附件
│   │   │   │   └── AgentSelector.tsx
│   │   │   └── index.ts
│   │   ├── files/
│   │   │   ├── pages/
│   │   │   │   └── FileManagerPage.tsx
│   │   │   └── components/
│   │   │       ├── FileList.tsx
│   │   │       └── UploadZone.tsx
│   │   ├── notifications/
│   │   │   └── NotificationCenter.tsx  # SSE 实时推送
│   │   └── analytics/
│   │       ├── pages/
│   │       │   └── DashboardPage.tsx
│   │       └── components/
│   │           ├── MetricsCard.tsx
│   │           └── BurndownChart.tsx   # Recharts
│   ├── shared/
│   │   ├── store/
│   │   │   └── uiStore.ts              # 主题、侧边栏、全局 loading
│   │   ├── hooks/
│   │   │   ├── useSSE.ts               # SSE 连接封装
│   │   │   └── usePermission.ts        # 权限检查 hook
│   │   └── utils/
│   │       └── routeGuard.ts
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── e2e/                            # Playwright 测试
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### Feature 模块结构规范

每个 feature 模块遵循统一结构：

```
features/<name>/
├── pages/        # 路由页面组件（只负责组合，不含业务逻辑）
├── components/   # 该功能专属 UI 组件
├── hooks/        # 功能专属 React hooks（含 API 调用）
├── store/        # 该功能的 Zustand slice（如需要）
└── index.ts      # 只导出公开 API
```

---

## 3.8 apps/admin-dashboard — 管理后台

与 web-portal 共享技术基础，差异点：

- 面向内部运营/开发人员，权限要求更严格（需 ADMIN 角色）
- 数据展示密度更高（使用 DataTable 密集模式）
- 功能模块侧重管理：用户管理、系统配置、知识库管理、审计日志、监控大屏

```
apps/admin-dashboard/src/features/
├── user-management/     # 用户列表、角色分配、批量操作
├── system-config/       # LLM Provider、存储、通知渠道配置
├── kb-management/       # 知识库集合管理、摄入任务、索引状态
├── agent-config/        # Agent 参数、系统提示词、模型选择
├── audit-logs/          # 操作审计日志（时间范围、用户、操作类型）
└── monitoring/          # 服务健康状态、Grafana 嵌入
```

---

## 3.9 apps/mobile-app — Taro 移动端

### 多端构建策略

| 目标平台 | 构建命令 |
|---------|---------|
| 微信小程序 | `taro build --type weapp` |
| H5 (移动浏览器) | `taro build --type h5` |
| React Native | `taro build --type rn` |
| 抖音小程序 | `taro build --type tt` |

### 目录结构

```
apps/mobile-app/
├── src/
│   ├── app.tsx              # 应用入口与全局配置
│   ├── app.config.ts        # Taro 应用配置（pages、tabBar、window）
│   ├── pages/
│   │   ├── index/           # 首页（工作台）
│   │   ├── projects/        # 项目列表/详情
│   │   ├── tasks/           # 任务管理（下拉刷新/上拉加载）
│   │   ├── notifications/   # 消息通知
│   │   └── profile/         # 个人中心
│   ├── components/          # 移动端专属组件（NutUI/Taro UI）
│   ├── store/               # Zustand（与 web 共享结构）
│   └── utils/               # 小程序特定工具（wx.* API 封装）
└── config/                  # Taro 编译配置
    ├── index.ts
    ├── dev.ts
    └── prod.ts
```

---

## 3.10 apps/design-system — 组件库 Storybook

```
apps/design-system/
├── src/stories/
│   ├── Button.stories.tsx
│   ├── Form.stories.tsx
│   ├── DataTable.stories.tsx
│   ├── Dialog.stories.tsx
│   ├── Colors.stories.tsx   # Design Token 色彩展示
│   └── Typography.stories.tsx
├── .storybook/
│   ├── main.ts              # Vite builder、插件配置
│   └── preview.ts           # 全局装饰器、主题注入
└── package.json
```

---

[← 上一章](./02-architecture.md) · [下一章：后端服务层详细设计 →](./04-backend.md)
