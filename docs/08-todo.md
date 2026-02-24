# 第八章 完整 TODO 清单（1020 项）

## 优先级说明

| 优先级 | 含义 |
|--------|------|
| 🔴 P0 | 阻塞性任务，MVP 发布前必须完成 |
| 🟠 P1 | 重要功能，首个迭代完成 |
| 🟢 P2 | 增强功能，后续迭代 |
| ⚪ P3 | 长期愿景 |

---

## 8.1 工作空间初始化（#1 - #50）

| # | 任务 | 优先级 |
|---|------|--------|
| 1 | 创建根目录 `enterprise-project-automation-platform` | 🔴 P0 |
| 2 | 初始化 Git 仓库，配置 `.gitignore`（Node/Python/Java/Go/IDE） | 🔴 P0 |
| 3 | 配置 `.gitattributes`（LF 换行、二进制文件标记） | 🟠 P1 |
| 4 | 创建 `pnpm-workspace.yaml`，声明 `apps/**` 和 `packages/**` | 🔴 P0 |
| 5 | 安装 pnpm 并在根目录执行 `pnpm init` | 🔴 P0 |
| 6 | 安装 Turborepo：`pnpm add -D turbo` | 🔴 P0 |
| 7 | 编写 `turbo.json`，定义 build/dev/lint/type-check/test/gen 任务 | 🔴 P0 |
| 8 | 配置 `turbo.json` `globalEnv`（NODE_ENV、API_BASE_URL 等） | 🟠 P1 |
| 9 | 配置 turbo.json pipeline 依赖关系（`^build` 依赖链） | 🔴 P0 |
| 10 | 配置 turbo 缓存远程存储（Vercel Remote Cache 或自建） | 🟢 P2 |
| 11 | 创建根 `tsconfig.base.json`，设置 strict 模式与路径别名 | 🔴 P0 |
| 12 | 创建 `packages/eslint-config/index.js`，统一 ESLint 规则 | 🔴 P0 |
| 13 | 创建 `packages/eslint-config/react.js`（React 专用规则） | 🟠 P1 |
| 14 | 配置 `prettier.config.js`（根目录），统一代码格式 | 🔴 P0 |
| 15 | 安装并配置 husky + lint-staged（pre-commit 钩子） | 🟠 P1 |
| 16 | 配置 commitlint（Conventional Commits 规范） | 🟠 P1 |
| 17 | 创建 `.vscode/extensions.json`（推荐插件列表） | 🟢 P2 |
| 18 | 创建 `.vscode/settings.json`（统一编辑器设置） | 🟢 P2 |
| 19 | 创建 `.vscode/launch.json`（多服务调试配置） | 🟢 P2 |
| 20 | 编写根目录 `Makefile`（dev/build/test/gen/clean 等命令） | 🔴 P0 |
| 21 | 创建 `tools/scripts/` 目录，编写初始化脚本 `bootstrap.sh` | 🟠 P1 |
| 22 | 编写 `tools/scripts/gen-api-client.sh`（openapi-generator 封装） | 🟠 P1 |
| 23 | 创建 `tools/generators/`，编写服务脚手架生成器 | 🟢 P2 |
| 24 | 编写 `tools/generators/new-feature.js`（前端 feature 模块生成器） | 🟢 P2 |
| 25 | 配置 `CODEOWNERS` 文件，定义各目录代码所有者 | 🟠 P1 |
| 26 | 创建 `.github/pull_request_template.md` | 🟠 P1 |
| 27 | 创建 `.github/ISSUE_TEMPLATE/`（Bug/Feature 模板） | 🟢 P2 |
| 28 | 配置 Renovate Bot 或 Dependabot（依赖自动更新） | 🟢 P2 |
| 29 | 编写根目录 `README.md`（项目简介、快速上手） | 🔴 P0 |
| 30 | 编写 `CONTRIBUTING.md`（贡献指南） | 🟠 P1 |
| 31 | 创建 `CHANGELOG.md`，配置 standard-version 自动生成 | 🟢 P2 |
| 32 | 配置 `.editorconfig` | 🟢 P2 |
| 33 | 配置 TypeScript Project References（根 `tsconfig.json`） | 🟠 P1 |
| 34 | 安装配置 changesets（Monorepo 版本管理） | 🟢 P2 |
| 35 | 配置 Docker `.dockerignore` 文件模板 | 🟠 P1 |
| 36 | 创建公共 GitHub Actions 复用 Workflow（`.github/actions/`） | 🟠 P1 |
| 37 | 编写 `setup-node.yml` 复用 Action | 🟠 P1 |
| 38 | 编写 `setup-python.yml` 复用 Action | 🟠 P1 |
| 39 | 编写 `setup-go.yml` 复用 Action | 🟠 P1 |
| 40 | 编写 `setup-java.yml` 复用 Action | 🟠 P1 |
| 41 | 配置 GitHub Environments（dev/staging/prod） | 🔴 P0 |
| 42 | 设置 GitHub Repository Secrets | 🔴 P0 |
| 43 | 配置 Branch Protection Rules（main/develop） | 🔴 P0 |
| 44 | 配置 SonarQube 或 CodeClimate 代码质量门禁 | 🟢 P2 |
| 45 | 配置 Codecov（覆盖率报告） | 🟠 P1 |
| 46 | 创建 `.env.example` 模板文件 | 🔴 P0 |
| 47 | 创建 `docker-compose.yml`（完整本地开发环境） | 🔴 P0 |
| 48 | 创建 `docker-compose.override.yml`（开发专用覆盖） | 🟠 P1 |
| 49 | 编写 `scripts/wait-for-services.sh`（等待基础设施就绪） | 🟠 P1 |
| 50 | 配置 Node.js 版本（`.nvmrc` 和 `.tool-versions`） | 🟠 P1 |

---

## 8.2 共享包层 packages/（#51 - #165）

### packages/schemas

| # | 任务 | 优先级 |
|---|------|--------|
| 51 | 初始化 `packages/schemas/package.json`（name: @eap/schemas） | 🔴 P0 |
| 52 | 配置 `packages/schemas/tsconfig.json`（strict, composite） | 🔴 P0 |
| 53 | 安装 zod 依赖 | 🔴 P0 |
| 54 | 创建 `src/common/pagination.ts`（PaginationSchema） | 🔴 P0 |
| 55 | 创建 `src/common/sort.ts`（SortSchema） | 🟠 P1 |
| 56 | 创建 `src/common/response.ts`（ApiResponseSchema\<T\>） | 🔴 P0 |
| 57 | 创建 `src/common/errors.ts`（ErrorResponseSchema） | 🔴 P0 |
| 58 | 创建 `src/common/id.ts`（UUIDSchema, IdSchema） | 🟠 P1 |
| 59 | 创建 `src/entities/user.ts`（UserSchema, UserRoleEnum） | 🔴 P0 |
| 60 | 创建 `src/entities/project.ts`（ProjectSchema, ProjectStatusEnum） | 🔴 P0 |
| 61 | 创建 `src/entities/task.ts`（TaskSchema, TaskStatusEnum, TaskPriorityEnum） | 🔴 P0 |
| 62 | 创建 `src/entities/workflow.ts`（WorkflowDefSchema, WorkflowInstanceSchema） | 🔴 P0 |
| 63 | 创建 `src/entities/file.ts`（FileMetaSchema） | 🟠 P1 |
| 64 | 创建 `src/entities/notification.ts`（NotificationSchema） | 🟠 P1 |
| 65 | 创建 `src/entities/tag.ts`（TagSchema） | 🟢 P2 |
| 66 | 创建 `src/requests/auth.ts`（LoginInput, RegisterInput, RefreshTokenInput） | 🔴 P0 |
| 67 | 创建 `src/requests/project.ts`（CreateProjectInput, UpdateProjectInput） | 🔴 P0 |
| 68 | 创建 `src/requests/task.ts`（CreateTaskInput, UpdateTaskInput, AssignTaskInput） | 🔴 P0 |
| 69 | 创建 `src/requests/workflow.ts`（CreateWorkflowInput, TriggerWorkflowInput） | 🔴 P0 |
| 70 | 创建 `src/requests/search.ts`（KBSearchInput, AgentChatInput） | 🟠 P1 |
| 71 | 创建 `src/responses/auth.ts`（TokenResponse, UserResponse） | 🔴 P0 |
| 72 | 创建 `src/responses/project.ts`（ProjectResponse, ProjectListResponse） | 🔴 P0 |
| 73 | 创建 `src/responses/workflow.ts`（WorkflowResponse, InstanceResponse） | 🔴 P0 |
| 74 | 创建 `src/responses/kb.ts`（SearchResultResponse, DocumentChunkResponse） | 🟠 P1 |
| 75 | 编写 `src/index.ts`（统一导出） | 🔴 P0 |
| 76 | 编写 `scripts/gen-json-schema.ts`（生成 JSON Schema 供后端使用） | 🟠 P1 |
| 77 | 配置 tsup 构建（ESM + CJS 双格式） | 🔴 P0 |
| 78 | 编写 schemas 单元测试（验证解析和错误信息） | 🟠 P1 |
| 79 | 发布 @eap/schemas 到私有 npm registry | 🟢 P2 |
| 80 | 为 Schema 添加 JSDoc 注释 | 🟢 P2 |

### packages/types

| # | 任务 | 优先级 |
|---|------|--------|
| 81 | 初始化 `packages/types/package.json`（name: @eap/types） | 🔴 P0 |
| 82 | 创建 `src/api.ts`（ApiResponse\<T\>, PaginatedResponse\<T\>, ApiError） | 🔴 P0 |
| 83 | 创建 `src/auth.ts`（UserRole, Permission, AuthContext, JWTPayload） | 🔴 P0 |
| 84 | 创建 `src/events.ts`（前端事件总线类型） | 🟠 P1 |
| 85 | 创建 `src/theme.ts`（主题 Token 类型） | 🟢 P2 |
| 86 | 创建 `src/route.ts`（路由元数据类型） | 🟠 P1 |
| 87 | 创建 `src/upload.ts`（FileUploadState, UploadProgress） | 🟠 P1 |
| 88 | 创建 `src/sse.ts`（SSEMessage, AgentStreamEvent） | 🟠 P1 |
| 89 | 编写 `src/index.ts`（统一导出） | 🔴 P0 |
| 90 | 配置 tsup 构建 | 🔴 P0 |

### packages/utils

| # | 任务 | 优先级 |
|---|------|--------|
| 91 | 初始化 `packages/utils/package.json`（name: @eap/utils） | 🔴 P0 |
| 92 | 创建 `src/date.ts`（日期格式化、相对时间） | 🟠 P1 |
| 93 | 创建 `src/string.ts`（truncate, slugify, capitalize） | 🟠 P1 |
| 94 | 创建 `src/url.ts`（URL 拼接、参数解析） | 🟠 P1 |
| 95 | 创建 `src/storage.ts`（localStorage 安全封装） | 🟠 P1 |
| 96 | 创建 `src/validation.ts`（通用验证辅助） | 🟠 P1 |
| 97 | 创建 `src/array.ts`（groupBy, unique, chunk） | 🟢 P2 |
| 98 | 创建 `src/object.ts`（pick, omit, deepMerge） | 🟢 P2 |
| 99 | 创建 `src/error.ts`（API 错误信息提取） | 🟠 P1 |
| 100 | 创建 `src/cn.ts`（clsx + twMerge） | 🔴 P0 |
| 101 | 创建 `src/async.ts`（retry, debounce, throttle, sleep） | 🟠 P1 |
| 102 | 创建 `src/crypto.ts`（UUID 生成、哈希） | 🟠 P1 |
| 103 | 编写 utils 单元测试（Vitest） | 🟠 P1 |
| 104 | 配置 tsup 构建（tree-shaking 友好） | 🔴 P0 |

### packages/ui-components

| # | 任务 | 优先级 |
|---|------|--------|
| 105 | 初始化 `packages/ui-components/package.json`（name: @eap/ui） | 🔴 P0 |
| 106 | 安装依赖：Radix UI、Tailwind CSS、clsx、tailwind-merge、cva | 🔴 P0 |
| 107 | 配置 `tailwind.config.ts`（Design Token 定义） | 🔴 P0 |
| 108 | 创建 `primitives/Button.tsx`（variant/size/loading） | 🔴 P0 |
| 109 | 创建 `primitives/Input.tsx`（error/addon/clearable） | 🔴 P0 |
| 110 | 创建 `primitives/Select.tsx`（基于 Radix UI） | 🔴 P0 |
| 111 | 创建 `primitives/Checkbox.tsx` | 🔴 P0 |
| 112 | 创建 `primitives/Switch.tsx` | 🟠 P1 |
| 113 | 创建 `primitives/RadioGroup.tsx` | 🟠 P1 |
| 114 | 创建 `primitives/Textarea.tsx`（autosize） | 🟠 P1 |
| 115 | 创建 `primitives/Badge.tsx`（status 变体） | 🔴 P0 |
| 116 | 创建 `primitives/Avatar.tsx`（含 fallback） | 🟠 P1 |
| 117 | 创建 `primitives/Tooltip.tsx` | 🟠 P1 |
| 118 | 创建 `primitives/Dialog.tsx` | 🔴 P0 |
| 119 | 创建 `primitives/Drawer.tsx` | 🟠 P1 |
| 120 | 创建 `primitives/Dropdown.tsx` | 🟠 P1 |
| 121 | 创建 `primitives/Tabs.tsx` | 🟠 P1 |
| 122 | 创建 `primitives/Accordion.tsx` | 🟢 P2 |
| 123 | 创建 `primitives/Progress.tsx` | 🟠 P1 |
| 124 | 创建 `primitives/Skeleton.tsx` | 🔴 P0 |
| 125 | 创建 `composed/DataTable.tsx`（排序/过滤/分页） | 🔴 P0 |
| 126 | 创建 `composed/Form.tsx`（React Hook Form 封装） | 🔴 P0 |
| 127 | 创建 `composed/FormField.tsx`（label + error 容器） | 🔴 P0 |
| 128 | 创建 `composed/SearchInput.tsx`（防抖） | 🟠 P1 |
| 129 | 创建 `composed/FileUpload.tsx`（拖拽上传 + 进度） | 🟠 P1 |
| 130 | 创建 `composed/DatePicker.tsx` | 🟠 P1 |
| 131 | 创建 `composed/Pagination.tsx` | 🔴 P0 |
| 132 | 创建 `composed/EmptyState.tsx` | 🟠 P1 |
| 133 | 创建 `composed/ErrorBoundary.tsx` | 🔴 P0 |
| 134 | 创建 `feedback/Toast.tsx` | 🔴 P0 |
| 135 | 创建 `feedback/Alert.tsx` | 🔴 P0 |
| 136 | 创建 `feedback/Loading.tsx` | 🟠 P1 |
| 137 | 创建 `layouts/Shell.tsx` | 🔴 P0 |
| 138 | 创建 `layouts/Sidebar.tsx` | 🔴 P0 |
| 139 | 创建 `layouts/PageHeader.tsx` | 🟠 P1 |
| 140 | 为所有组件编写 Storybook Stories | 🟠 P1 |

### packages/api-client

| # | 任务 | 优先级 |
|---|------|--------|
| 141 | 初始化 `packages/api-client/package.json`（name: @eap/api-client） | 🔴 P0 |
| 142 | 安装依赖：axios、@tanstack/react-query | 🔴 P0 |
| 143 | 创建 `src/client.ts`（Axios 实例配置，含拦截器） | 🔴 P0 |
| 144 | 创建 `src/interceptors/auth.ts`（401 自动刷新 Token） | 🔴 P0 |
| 145 | 创建 `src/interceptors/error.ts`（统一错误格式化） | 🔴 P0 |
| 146 | 配置 openapi-generator-cli（`openapitools.json`） | 🔴 P0 |
| 147 | 创建 `generate.sh`（从各服务 OpenAPI YAML 生成客户端） | 🔴 P0 |
| 148 | 生成 `src/generated/gateway/` | 🔴 P0 |
| 149 | 生成 `src/generated/core/` | 🔴 P0 |
| 150 | 生成 `src/generated/workflow/` | 🟠 P1 |
| 151 | 生成 `src/generated/kb/` 和 `src/generated/agent/` | 🟠 P1 |
| 152 | 创建 `src/hooks/useAuth.ts` | 🔴 P0 |
| 153 | 创建 `src/hooks/useProjects.ts` | 🔴 P0 |
| 154 | 创建 `src/hooks/useTasks.ts` | 🔴 P0 |
| 155 | 创建 `src/hooks/useWorkflows.ts` | 🟠 P1 |
| 156 | 创建 `src/hooks/useKnowledge.ts` | 🟠 P1 |
| 157 | 创建 `src/hooks/useAgentChat.ts`（SSE 流式） | 🟠 P1 |
| 158 | 创建 `src/hooks/useFiles.ts` | 🟠 P1 |
| 159 | 配置 QueryClient defaultOptions（staleTime/gcTime） | 🔴 P0 |
| 160 | 创建 `src/query-keys.ts`（统一 Query Key 工厂） | 🟠 P1 |
| 161 | 创建 `src/mock/handlers.ts`（MSW mock handlers） | 🟠 P1 |
| 162 | 创建 `src/mock/fixtures/` 目录（fixture 数据） | 🟠 P1 |
| 163 | 在 CI 中添加 OpenAPI Spec 一致性验证 | 🟠 P1 |
| 164 | 配置 tsup 构建 | 🔴 P0 |
| 165 | 编写 api-client 集成测试 | 🟢 P2 |

---

## 8.3 前端应用层 apps/（#166 - #278）

### web-portal

| # | 任务 | 优先级 |
|---|------|--------|
| 166 | 用 `pnpm create vite` 初始化 apps/web-portal（react-ts） | 🔴 P0 |
| 167 | 更新 `package.json`，安装所有依赖 | 🔴 P0 |
| 168 | 配置 `vite.config.ts`（路径别名、代理、环境变量） | 🔴 P0 |
| 169 | 配置 `tailwind.config.ts`（引用 @eap/ui 主题） | 🔴 P0 |
| 170 | 配置 `tsconfig.json`（继承 tsconfig.base.json） | 🔴 P0 |
| 171 | 配置 `.env.example` 和 `.env.local` | 🔴 P0 |
| 172 | 创建 `src/main.tsx`（应用入口） | 🔴 P0 |
| 173 | 创建 `src/app/providers.tsx`（QueryClient, Router, AuthProvider） | 🔴 P0 |
| 174 | 创建 `src/app/router.tsx`（React Router v6 Data Router） | 🔴 P0 |
| 175 | 创建 `src/app/layout/Shell.tsx` | 🔴 P0 |
| 176 | 创建 `src/app/layout/Sidebar.tsx` | 🔴 P0 |
| 177 | 创建 `src/app/layout/Topbar.tsx` | 🔴 P0 |
| 178 | 配置代码分割（React.lazy + Suspense） | 🟠 P1 |
| 179 | 创建 `features/auth/pages/LoginPage.tsx` | 🔴 P0 |
| 180 | 创建 `features/auth/pages/RegisterPage.tsx` | 🔴 P0 |
| 181 | 创建 `features/auth/pages/ForgotPasswordPage.tsx` | 🟠 P1 |
| 182 | 创建 `features/auth/components/LoginForm.tsx`（RHF + Zod） | 🔴 P0 |
| 183 | 创建 `features/auth/components/OAuthButtons.tsx` | 🟠 P1 |
| 184 | 创建 `features/auth/store/authStore.ts`（Zustand） | 🔴 P0 |
| 185 | 实现 ProtectedRoute（未登录重定向） | 🔴 P0 |
| 186 | 实现 OAuth2 callback 处理页面 | 🟠 P1 |
| 187 | 创建 `features/projects/pages/ProjectListPage.tsx` | 🔴 P0 |
| 188 | 创建 `features/projects/pages/ProjectDetailPage.tsx` | 🔴 P0 |
| 189 | 创建 `features/projects/components/ProjectCard.tsx` | 🔴 P0 |
| 190 | 创建 `features/projects/components/ProjectForm.tsx` | 🔴 P0 |
| 191 | 创建 `features/projects/components/ProjectList.tsx` | 🔴 P0 |
| 192 | 创建 `features/projects/components/ProjectFilter.tsx` | 🟠 P1 |
| 193 | 创建 `features/tasks/pages/TaskBoardPage.tsx`（看板视图） | 🔴 P0 |
| 194 | 创建 `features/tasks/pages/TaskListPage.tsx` | 🔴 P0 |
| 195 | 创建 `features/tasks/components/TaskCard.tsx`（可拖拽） | 🔴 P0 |
| 196 | 创建 `features/tasks/components/TaskForm.tsx` | 🔴 P0 |
| 197 | 集成 dnd-kit 实现拖拽任务卡片 | 🟠 P1 |
| 198 | 创建 `features/workflows/pages/WorkflowListPage.tsx` | 🟠 P1 |
| 199 | 创建 `features/workflows/pages/WorkflowDetailPage.tsx` | 🟠 P1 |
| 200 | 创建 `features/workflows/components/WorkflowDiagram.tsx`（DAG 可视化） | 🟠 P1 |
| 201 | 创建 `features/knowledge/pages/KnowledgeSearchPage.tsx` | 🟠 P1 |
| 202 | 创建 `features/knowledge/components/SearchResultCard.tsx` | 🟠 P1 |
| 203 | 创建 `features/agents/pages/AgentChatPage.tsx` | 🔴 P0 |
| 204 | 实现 SSE 流式接收 Agent 响应（useAgentChat hook） | 🔴 P0 |
| 205 | 创建 `features/agents/components/ChatMessage.tsx`（含 Markdown 渲染） | 🔴 P0 |
| 206 | 创建 `features/agents/components/AgentSelector.tsx` | 🟠 P1 |
| 207 | 创建 `features/analytics/pages/DashboardPage.tsx` | 🟢 P2 |
| 208 | 集成 Recharts 实现数据可视化 | 🟢 P2 |
| 209 | 创建 `features/files/pages/FileManagerPage.tsx` | 🟠 P1 |
| 210 | 实现分片上传功能 | 🟠 P1 |
| 211 | 创建 `features/notifications/NotificationCenter.tsx` | 🟠 P1 |
| 212 | 实现通知 SSE 实时推送 | 🟠 P1 |
| 213 | 创建 `shared/store/uiStore.ts` | 🔴 P0 |
| 214 | 配置 i18n 国际化（react-i18next） | 🟢 P2 |
| 215 | 配置全局 Error Boundary | 🔴 P0 |
| 216 | 实现 404 和 403 错误页面 | 🟠 P1 |
| 217 | 配置 Vitest 测试环境 | 🔴 P0 |
| 218 | 编写 auth 功能单元测试 | 🔴 P0 |
| 219 | 编写 projects 功能单元测试 | 🟠 P1 |
| 220 | 配置 Playwright E2E 测试环境 | 🟠 P1 |
| 221 | 编写登录/注册 E2E 测试 | 🟠 P1 |
| 222 | 编写项目创建/管理 E2E 测试 | 🟠 P1 |
| 223 | 配置 Lighthouse CI（性能监测） | 🟢 P2 |
| 224 | 配置 Sentry（前端错误监控） | 🟠 P1 |
| 225 | 实现 Performance Metrics 上报 | 🟢 P2 |

### admin-dashboard

| # | 任务 | 优先级 |
|---|------|--------|
| 226 | 初始化 apps/admin-dashboard | 🔴 P0 |
| 227 | 配置 vite + tailwind + tsconfig | 🔴 P0 |
| 228 | 创建基础布局（Shell + Sidebar + Header） | 🔴 P0 |
| 229 | 实现管理员权限验证（RBAC 检查） | 🔴 P0 |
| 230 | 创建用户管理页面（列表、创建、编辑、禁用） | 🔴 P0 |
| 231 | 实现角色与权限管理界面 | 🟠 P1 |
| 232 | 创建系统参数配置页面 | 🟠 P1 |
| 233 | 创建知识库管理页面（集合创建/删除/摄入） | 🟠 P1 |
| 234 | 创建 Agent 参数配置页面 | 🟠 P1 |
| 235 | 创建审计日志查询页面 | 🟠 P1 |
| 236 | 创建系统监控大屏（Grafana iframe 嵌入） | 🟢 P2 |
| 237 | 实现服务健康状态展示 | 🟠 P1 |
| 238 | 创建 Kafka Topics 监控页面 | 🟢 P2 |
| 239 | 编写 admin-dashboard 单元测试 | 🟠 P1 |
| 240 | 编写 admin-dashboard E2E 测试 | 🟠 P1 |

### mobile-app（Taro）

| # | 任务 | 优先级 |
|---|------|--------|
| 241 | 使用 `taro init` 初始化 apps/mobile-app | 🟠 P1 |
| 242 | 配置 Taro 编译参数（config/index.ts） | 🟠 P1 |
| 243 | 安装 @eap/schemas, @eap/types, @eap/utils | 🟠 P1 |
| 244 | 创建 `src/app.config.ts`（小程序全局配置） | 🟠 P1 |
| 245 | 创建首页（工作台） | 🟠 P1 |
| 246 | 创建项目列表/详情页面 | 🟠 P1 |
| 247 | 创建任务管理页面（下拉刷新/上拉加载） | 🟠 P1 |
| 248 | 创建消息通知页面 | 🟠 P1 |
| 249 | 创建个人中心页面 | 🟠 P1 |
| 250 | 实现小程序登录（code → Token 换取） | 🟠 P1 |
| 251 | 封装通用移动端组件（NutUI/Taro UI） | 🟠 P1 |
| 252 | 实现无限滚动 Hook | 🟠 P1 |
| 253 | 配置微信小程序分包加载 | 🟠 P1 |
| 254 | 实现文件/图片上传（调用 file-service） | 🟠 P1 |
| 255 | 配置 H5 构建 | 🟢 P2 |

### design-system

| # | 任务 | 优先级 |
|---|------|--------|
| 256 | 使用 `npx storybook init` 初始化 | 🟠 P1 |
| 257 | 配置 `.storybook/main.ts`（Vite builder） | 🟠 P1 |
| 258 | 配置 `.storybook/preview.ts`（全局装饰器） | 🟠 P1 |
| 259 | 编写 Button/Form/DataTable/Dialog Stories | 🟠 P1 |
| 260 | 编写 Color Palette 展示页 | 🟢 P2 |
| 261 | 配置 Chromatic（视觉回归测试） | 🟢 P2 |
| 262 | 配置 Storybook 部署（GitHub Pages） | 🟢 P2 |

---

## 8.4 后端服务层 services/（#263 - #429）

### api-gateway（Go）

| # | 任务 | 优先级 |
|---|------|--------|
| 263 | 初始化 services/api-gateway（`go mod init`） | 🔴 P0 |
| 264 | 安装依赖：Gin, zap, viper, OpenTelemetry | 🔴 P0 |
| 265 | 创建 `cmd/gateway/main.go` | 🔴 P0 |
| 266 | 创建 `internal/config/config.go` | 🔴 P0 |
| 267 | 创建 `internal/router/routes.go` | 🔴 P0 |
| 268 | 实现 `internal/middleware/auth.go`（JWT 验证，gRPC 调用） | 🔴 P0 |
| 269 | 实现 `internal/middleware/ratelimit.go`（Redis Token Bucket） | 🔴 P0 |
| 270 | 实现 `internal/middleware/cors.go` | 🔴 P0 |
| 271 | 实现 `internal/middleware/logger.go`（zap 结构化日志） | 🔴 P0 |
| 272 | 实现 `internal/middleware/tracing.go`（OpenTelemetry） | 🟠 P1 |
| 273 | 实现 `internal/middleware/recovery.go`（panic 恢复） | 🔴 P0 |
| 274 | 实现 `internal/proxy/reverse_proxy.go` | 🔴 P0 |
| 275 | 实现 `internal/grpc/auth_client.go`（连接池） | 🔴 P0 |
| 276 | 实现 `internal/health/handler.go`（/health 和 /ready） | 🔴 P0 |
| 277 | 实现请求体大小限制中间件 | 🟠 P1 |
| 278 | 实现统一响应格式（`pkg/response/`） | 🔴 P0 |
| 279 | 实现错误码定义（`pkg/errors/`） | 🔴 P0 |
| 280 | 配置 Prometheus 指标暴露（/metrics） | 🟠 P1 |
| 281 | 实现优雅关闭（Graceful Shutdown） | 🔴 P0 |
| 282 | 编写单元测试（中间件表格驱动测试） | 🔴 P0 |
| 283 | 编写集成测试（E2E 路由测试） | 🟠 P1 |
| 284 | 编写 Dockerfile（多阶段构建，scratch 基础镜像） | 🔴 P0 |
| 285 | 配置 K8s Deployment + HPA YAML | 🔴 P0 |

### auth-service（Go）

| # | 任务 | 优先级 |
|---|------|--------|
| 286 | 初始化 services/auth-service | 🔴 P0 |
| 287 | 创建 `cmd/authserver/main.go`（HTTP + gRPC 双服务） | 🔴 P0 |
| 288 | 创建 `internal/domain/user.go` 和 `token.go` | 🔴 P0 |
| 289 | 实现 `internal/service/auth_service.go` | 🔴 P0 |
| 290 | 实现 `internal/service/jwt_service.go` | 🔴 P0 |
| 291 | 实现 `internal/service/oauth_service.go`（GitHub/Google） | 🟠 P1 |
| 292 | 实现 `internal/repository/user_repo.go`（PostgreSQL） | 🔴 P0 |
| 293 | 实现 `internal/cache/token_cache.go`（Redis 黑名单） | 🔴 P0 |
| 294 | 编写 `proto/auth.proto` | 🔴 P0 |
| 295 | 生成 gRPC Go 代码 | 🔴 P0 |
| 296 | 实现 gRPC ValidateToken servicer | 🔴 P0 |
| 297 | 实现 HTTP auth handler（注册/登录/刷新/登出） | 🔴 P0 |
| 298 | 实现密码哈希（bcrypt, cost=12） | 🔴 P0 |
| 299 | 实现邮箱验证码 | 🟠 P1 |
| 300 | 实现密码重置流程 | 🟠 P1 |
| 301 | 实现 RBAC 权限模型 | 🔴 P0 |
| 302 | 编写 Goose 数据库迁移脚本 | 🔴 P0 |
| 303 | 编写单元测试 + 集成测试 | 🔴 P0 |
| 304 | 编写 Dockerfile | 🔴 P0 |
| 305 | 配置 K8s Deployment（HTTP + gRPC 双端口） | 🔴 P0 |

### core-service（Java Spring Boot）

| # | 任务 | 优先级 |
|---|------|--------|
| 306 | 使用 Spring Initializr 初始化 core-service | 🔴 P0 |
| 307 | 配置 `build.gradle.kts`（Spring Web/JPA/Kafka/Validation） | 🔴 P0 |
| 308 | 配置 `application.yml`（多环境） | 🔴 P0 |
| 309 | 创建 `domain/project/Project.java`（聚合根） | 🔴 P0 |
| 310 | 创建 `domain/project/ProjectId.java`（值对象） | 🔴 P0 |
| 311 | 创建 `domain/project/ProjectStatus.java` | 🔴 P0 |
| 312 | 创建 `domain/project/ProjectRepository.java`（接口） | 🔴 P0 |
| 313 | 创建 `domain/task/Task.java`、TaskStatus/Priority | 🔴 P0 |
| 314 | 创建 `domain/task/TaskRepository.java` | 🔴 P0 |
| 315 | 创建 `domain/user/UserRef.java` | 🔴 P0 |
| 316 | 创建 `application/project/ProjectApplicationService.java` | 🔴 P0 |
| 317 | 创建 CQRS Commands（CreateProject/Update/Delete） | 🔴 P0 |
| 318 | 创建 CQRS Queries（GetProject/ListProjects） | 🔴 P0 |
| 319 | 创建 TaskApplicationService + Commands/Queries | 🔴 P0 |
| 320 | 创建 `infrastructure/persistence/ProjectJpaRepository.java` | 🔴 P0 |
| 321 | 创建 JPA 实体（ProjectEntity/TaskEntity） | 🔴 P0 |
| 322 | 实现 DDD 防腐层（领域对象 ↔ JPA 实体映射） | 🔴 P0 |
| 323 | 创建 `infrastructure/kafka/DomainEventPublisher.java` | 🔴 P0 |
| 324 | 定义 Kafka 领域事件（ProjectCreated, TaskAssigned 等） | 🔴 P0 |
| 325 | 创建 `infrastructure/cache/ProjectCacheService.java`（Redis） | 🟠 P1 |
| 326 | 创建 `interfaces/rest/ProjectController.java` | 🔴 P0 |
| 327 | 创建 `interfaces/rest/TaskController.java` | 🔴 P0 |
| 328 | 实现统一异常处理（@ControllerAdvice） | 🔴 P0 |
| 329 | 实现请求参数验证（@Valid） | 🔴 P0 |
| 330 | 创建 DTO 目录（Request/Response 与领域模型解耦） | 🔴 P0 |
| 331 | 配置 Springdoc OpenAPI 注解 | 🔴 P0 |
| 332 | 实现分页查询（Pageable） | 🔴 P0 |
| 333 | 编写 Flyway 迁移脚本（projects/tasks 表） | 🔴 P0 |
| 334 | 编写领域层 + 应用层单元测试 | 🔴 P0 |
| 335 | 编写 Testcontainers 集成测试 | 🟠 P1 |
| 336 | 编写 @WebMvcTest API 层测试 | 🟠 P1 |
| 337 | 编写 Dockerfile（多阶段，OpenJDK 21 slim） | 🔴 P0 |
| 338 | 配置 K8s Deployment + ConfigMap | 🔴 P0 |
| 339 | 配置 JVM 内存参数（容器感知） | 🟠 P1 |
| 340 | 配置 Prometheus JVM Metrics Exporter | 🟠 P1 |

### workflow-engine（Python）

| # | 任务 | 优先级 |
|---|------|--------|
| 341 | 初始化 services/workflow-engine（pyproject.toml, uv） | 🔴 P0 |
| 342 | 安装依赖：FastAPI, SQLAlchemy 2, Celery, pydantic | 🔴 P0 |
| 343 | 创建 `src/api/main.py` | 🔴 P0 |
| 344 | 创建 workflows/instances routers | 🔴 P0 |
| 345 | 创建 WorkflowDef / WorkflowInstance ORM 模型 | 🔴 P0 |
| 346 | 编写 Alembic 迁移脚本 | 🔴 P0 |
| 347 | 实现 `engine/dag.py`（DAG 解析、循环检测） | 🔴 P0 |
| 348 | 实现 `engine/state_machine.py` | 🔴 P0 |
| 349 | 实现 `engine/executor.py` | 🔴 P0 |
| 350 | 实现 `engine/step_runner.py` | 🔴 P0 |
| 351 | 实现 `steps/base.py`（步骤抽象基类，含 retry） | 🔴 P0 |
| 352 | 实现 `steps/http_step.py` | 🔴 P0 |
| 353 | 实现 `steps/script_step.py`（沙箱执行） | 🟠 P1 |
| 354 | 实现 `steps/approval_step.py` | 🟠 P1 |
| 355 | 实现 `steps/agent_step.py` | 🟠 P1 |
| 356 | 实现 `steps/condition_step.py` | 🟠 P1 |
| 357 | 实现 `steps/parallel_step.py` | 🟠 P1 |
| 358 | 配置 Celery（Redis Broker + Backend） | 🔴 P0 |
| 359 | 实现 workflow Celery Tasks | 🔴 P0 |
| 360 | 实现 Kafka 消费者（监听 core-service 事件） | 🔴 P0 |
| 361 | 编写 DAG 解析 + 状态机单元测试 | 🔴 P0 |
| 362 | 编写端到端工作流集成测试 | 🟠 P1 |
| 363 | 编写 Dockerfile + Celery Worker Dockerfile | 🔴 P0 |
| 364 | 配置 K8s Deployment（API + Worker 分开部署） | 🔴 P0 |

### notification-service（Go）

| # | 任务 | 优先级 |
|---|------|--------|
| 365 | 初始化 services/notification-service | 🔴 P0 |
| 366 | 实现 Kafka Consumer（各 Topic 事件路由） | 🔴 P0 |
| 367 | 实现事件到通知规则映射 | 🔴 P0 |
| 368 | 实现站内信渠道（SSE 长连接管理器） | 🔴 P0 |
| 369 | 实现邮件渠道（SMTP / SendGrid） | 🟠 P1 |
| 370 | 实现 Webhook 渠道 | 🟢 P2 |
| 371 | 实现通知模板管理 | 🟠 P1 |
| 372 | 实现通知记录持久化 | 🟠 P1 |
| 373 | 实现用户通知偏好设置 | 🟢 P2 |
| 374 | 实现通知已读状态管理 | 🟠 P1 |
| 375 | 编写单元测试 | 🟠 P1 |
| 376 | 编写 Dockerfile + K8s Deployment | 🔴 P0 |

### file-service（Python）

| # | 任务 | 优先级 |
|---|------|--------|
| 377 | 初始化 services/file-service（pyproject.toml） | 🔴 P0 |
| 378 | 实现 `storage/s3_client.py`（boto3 + MinIO 兼容） | 🔴 P0 |
| 379 | 实现分片上传 API（Multipart Upload） | 🔴 P0 |
| 380 | 实现预签名 URL 下载（TTL 15min） | 🔴 P0 |
| 381 | 实现文件元数据 CRUD | 🔴 P0 |
| 382 | 实现图片处理（压缩/缩略图，Pillow） | 🟠 P1 |
| 383 | 实现 PDF 文本提取（PyMuPDF，触发 KB 索引） | 🟠 P1 |
| 384 | 实现文件类型校验（MIME 白名单） | 🔴 P0 |
| 385 | 实现文件大小限制（per-user quota） | 🟠 P1 |
| 386 | 编写单元测试 | 🟠 P1 |
| 387 | 编写 Dockerfile + K8s Deployment | 🔴 P0 |

---

## 8.5 AI 能力层 ai/（#388 - #512）

### knowledge-base

| # | 任务 | 优先级 |
|---|------|--------|
| 388 | 初始化 ai/knowledge-base（pyproject.toml） | 🔴 P0 |
| 389 | 安装依赖：FastAPI, grpcio, qdrant-client, langchain, sentence-transformers | 🔴 P0 |
| 390 | 创建 `config/kb_config.yaml` | 🔴 P0 |
| 391 | 实现 `loaders/base_loader.py` | 🔴 P0 |
| 392 | 实现 `loaders/pdf_loader.py`（PyMuPDF） | 🔴 P0 |
| 393 | 实现 `loaders/markdown_loader.py` | 🔴 P0 |
| 394 | 实现 `loaders/code_loader.py`（语言自动检测） | 🟠 P1 |
| 395 | 实现 `loaders/docx_loader.py` | 🟠 P1 |
| 396 | 实现 `loaders/web_loader.py`（Playwright） | 🟢 P2 |
| 397 | 实现 `loaders/loader_factory.py` | 🔴 P0 |
| 398 | 实现 `chunkers/base_chunker.py` | 🔴 P0 |
| 399 | 实现 `chunkers/recursive_chunker.py`（512 tokens，50 重叠） | 🔴 P0 |
| 400 | 实现 `chunkers/semantic_chunker.py`（语义边界） | 🟠 P1 |
| 401 | 实现 `chunkers/code_chunker.py`（AST 级别） | 🟠 P1 |
| 402 | 实现 `enrichers/metadata_extractor.py` | 🔴 P0 |
| 403 | 实现 `ingestion/pipeline.py`（主流程） | 🔴 P0 |
| 404 | 实现摄入幂等性（content_hash 去重） | 🟠 P1 |
| 405 | 实现批量摄入 API | 🟠 P1 |
| 406 | 实现摄入进度追踪 | 🟠 P1 |
| 407 | 实现 `embeddings/openai_embedder.py`（text-embedding-3-large） | 🔴 P0 |
| 408 | 实现 `embeddings/local_embedder.py`（BAAI/bge-m3） | 🟠 P1 |
| 409 | 实现 `embeddings/cache.py`（Redis 向量缓存） | 🟠 P1 |
| 410 | 实现 `vector_store/qdrant_store.py` | 🔴 P0 |
| 411 | 实现 `vector_store/collection_manager.py` | 🔴 P0 |
| 412 | 配置 Qdrant payload 索引（元数据过滤） | 🟠 P1 |
| 413 | 实现 `retrieval/vector_retriever.py` | 🔴 P0 |
| 414 | 实现 `retrieval/bm25_retriever.py`（PostgreSQL GIN） | 🔴 P0 |
| 415 | 实现 `retrieval/hybrid_retriever.py`（RRF 融合） | 🔴 P0 |
| 416 | 实现 `retrieval/reranker.py`（Cross-Encoder） | 🟠 P1 |
| 417 | 实现查询改写（Query Rewriting） | 🟢 P2 |
| 418 | 编写 `proto/knowledge.proto` | 🔴 P0 |
| 419 | 生成 Python gRPC 代码 | 🔴 P0 |
| 420 | 实现 gRPC servicer | 🔴 P0 |
| 421 | 实现 FastAPI HTTP routers（search/ingest/collections） | 🔴 P0 |
| 422 | 实现 Webhook（file-service 上传后自动索引） | 🟠 P1 |
| 423 | 编写单元测试（分块/嵌入/检索） | 🔴 P0 |
| 424 | 编写集成测试（真实 Qdrant） | 🟠 P1 |
| 425 | 编写 RAG 质量评估脚本（Ragas） | 🟢 P2 |
| 426 | 编写 Dockerfile + K8s Deployment（HTTP + gRPC 双端口） | 🔴 P0 |

### agent-platform

| # | 任务 | 优先级 |
|---|------|--------|
| 427 | 初始化 ai/agent-platform（pyproject.toml） | 🔴 P0 |
| 428 | 安装依赖：FastAPI, anthropic, pydantic, asyncio, httpx | 🔴 P0 |
| 429 | 实现 `orchestrator/planner.py`（LLM 任务分解） | 🔴 P0 |
| 430 | 实现 `orchestrator/dispatcher.py`（Agent 调度） | 🔴 P0 |
| 431 | 实现 `orchestrator/state_machine.py` | 🔴 P0 |
| 432 | 实现 `orchestrator/result_aggregator.py` | 🔴 P0 |
| 433 | 实现 `agents/base_agent.py`（Tool 调用循环） | 🔴 P0 |
| 434 | 实现 `agents/code_agent.py` | 🔴 P0 |
| 435 | 实现 `agents/docs_agent.py` | 🟠 P1 |
| 436 | 实现 `agents/test_agent.py` | 🟠 P1 |
| 437 | 实现 `agents/review_agent.py` | 🟠 P1 |
| 438 | 实现 `agents/research_agent.py` | 🟠 P1 |
| 439 | 实现 `agents/data_agent.py` | 🟢 P2 |
| 440 | 实现 `tools/registry.py`（Tool 注册中心） | 🔴 P0 |
| 441 | 实现 `tools/kb_tools.py`（KB gRPC 调用） | 🔴 P0 |
| 442 | 实现 `tools/code_tools.py`（Docker 沙箱执行） | 🟠 P1 |
| 443 | 实现 `tools/git_tools.py` | 🟠 P1 |
| 444 | 实现 `tools/project_tools.py`（core-service 调用） | 🟠 P1 |
| 445 | 实现 `tools/web_tools.py`（Serper/Tavily 搜索） | 🟠 P1 |
| 446 | 实现 `tools/file_tools.py`（file-service 调用） | 🟠 P1 |
| 447 | 实现 `memory/short_term.py`（含 Token 截断） | 🔴 P0 |
| 448 | 实现 `memory/working_memory.py`（Redis） | 🟠 P1 |
| 449 | 实现 `memory/long_term.py`（PostgreSQL + 向量） | 🟢 P2 |
| 450 | 实现 SSE 流式对话接口（`routers/chat.py`） | 🔴 P0 |
| 451 | 实现异步任务管理接口（`routers/tasks.py`） | 🔴 P0 |
| 452 | 实现会话管理接口（`routers/sessions.py`） | 🟠 P1 |
| 453 | 实现用户取消 Agent 任务 | 🟠 P1 |
| 454 | 实现 Token 用量追踪与成本控制 | 🟠 P1 |
| 455 | 实现 Anthropic Claude 模型调用（claude-sonnet-4-5） | 🔴 P0 |
| 456 | 实现 LLM Provider 抽象层 | 🟢 P2 |
| 457 | 实现 Agent 系统提示词管理（可配置、版本化） | 🟠 P1 |
| 458 | 编写单元测试（Planner 解析、Tool 调用） | 🔴 P0 |
| 459 | 编写集成测试（端到端 Agent 任务） | 🟠 P1 |
| 460 | 编写 Dockerfile + K8s Deployment | 🔴 P0 |

---

## 8.6 基础设施与 CI/CD（#461 - #590）

### 本地开发环境

| # | 任务 | 优先级 |
|---|------|--------|
| 461 | 编写 `docker-compose.yml`（PostgreSQL/Redis/Qdrant/Kafka/MinIO） | 🔴 P0 |
| 462 | 配置 PostgreSQL 容器（多 database 初始化脚本） | 🔴 P0 |
| 463 | 配置 Redis 容器（AOF 持久化） | 🔴 P0 |
| 464 | 配置 Qdrant 容器（本地 volume 挂载） | 🔴 P0 |
| 465 | 配置 Kafka 容器（kraft 单节点模式） | 🔴 P0 |
| 466 | 配置 MinIO 容器（初始化桶和 Access Key） | 🔴 P0 |
| 467 | 配置 Prometheus + Grafana + Jaeger 容器 | 🟠 P1 |
| 468 | 编写 `scripts/init-db.sql`（创建多 database） | 🔴 P0 |
| 469 | 编写 `scripts/create-kafka-topics.sh` | 🔴 P0 |
| 470 | 编写 `scripts/seed-data.sh`（测试数据填充） | 🟠 P1 |
| 471 | 编写 `scripts/reset-dev.sh`（一键重置） | 🟠 P1 |

### Kubernetes

| # | 任务 | 优先级 |
|---|------|--------|
| 472 | 创建 `infra/kubernetes/base/` 目录结构（8 个服务） | 🔴 P0 |
| 473 | 编写 api-gateway Deployment + Service + HPA + PDB YAML | 🔴 P0 |
| 474 | 编写 auth-service Deployment（HTTP + gRPC 双端口） | 🔴 P0 |
| 475 | 编写 core-service Deployment | 🔴 P0 |
| 476 | 编写 workflow-engine Deployment + CeleryWorker Deployment | 🔴 P0 |
| 477 | 编写 notification-service Deployment | 🔴 P0 |
| 478 | 编写 file-service Deployment | 🔴 P0 |
| 479 | 编写 knowledge-base Deployment（HTTP + gRPC） | 🔴 P0 |
| 480 | 编写 agent-platform Deployment | 🔴 P0 |
| 481 | 编写所有服务的 HPA YAML | 🟠 P1 |
| 482 | 编写 Ingress YAML（nginx-ingress 路由规则） | 🔴 P0 |
| 483 | 配置 cert-manager CRD（TLS 自动申请） | 🟠 P1 |
| 484 | 编写 NetworkPolicy YAML（服务间最小权限） | 🟠 P1 |
| 485 | 创建 Kustomize overlays（dev/staging/prod） | 🔴 P0 |
| 486 | 安装 External Secrets Operator | 🟠 P1 |
| 487 | 配置 HashiCorp Vault | 🟠 P1 |
| 488 | 编写 ExternalSecret YAML | 🟠 P1 |
| 489 | 配置 Trivy 镜像漏洞扫描（集成 CI） | 🟠 P1 |
| 490 | 配置 Falco（运行时安全检测） | 🟢 P2 |

### Terraform

| # | 任务 | 优先级 |
|---|------|--------|
| 491 | 创建 `infra/terraform/main.tf` | 🟠 P1 |
| 492 | 创建 K8s 集群模块（EKS/GKE/AKS） | 🟠 P1 |
| 493 | 创建 RDS PostgreSQL 模块（Multi-AZ） | 🟠 P1 |
| 494 | 创建 ElastiCache Redis 模块 | 🟠 P1 |
| 495 | 创建 S3 桶模块（含生命周期规则） | 🟠 P1 |
| 496 | 创建 MSK Kafka 模块 | 🟠 P1 |
| 497 | 配置 Remote State（S3 + DynamoDB Lock） | 🟠 P1 |
| 498 | 配置 Terraform Workspace（dev/staging/prod） | 🟠 P1 |

### CI/CD

| # | 任务 | 优先级 |
|---|------|--------|
| 499 | 编写 `.github/workflows/ci-frontend.yml` | 🔴 P0 |
| 500 | 编写 `.github/workflows/ci-backend-go.yml` | 🔴 P0 |
| 501 | 编写 `.github/workflows/ci-backend-java.yml` | 🔴 P0 |
| 502 | 编写 `.github/workflows/ci-backend-python.yml` | 🔴 P0 |
| 503 | 编写 `.github/workflows/ci-ai.yml` | 🔴 P0 |
| 504 | 配置 Docker 镜像推送（GHCR） | 🔴 P0 |
| 505 | 实现镜像 Tag 策略（git sha + semver） | 🟠 P1 |
| 506 | 编写 `.github/workflows/deploy-dev.yml` | 🔴 P0 |
| 507 | 编写 `.github/workflows/deploy-staging.yml`（人工审批） | 🔴 P0 |
| 508 | 编写 `.github/workflows/deploy-prod.yml`（蓝绿部署） | 🔴 P0 |
| 509 | 配置 Smoke Test Job（部署后健康检查） | 🟠 P1 |
| 510 | 实现自动回滚 Job | 🟠 P1 |
| 511 | 配置 Path Filters（仅相关文件变更触发 CI） | 🟠 P1 |
| 512 | 配置 Concurrency Group | 🟠 P1 |
| 513 | 配置 ArgoCD（GitOps 持续交付） | 🟠 P1 |
| 514 | 配置 CodeQL 安全扫描 | 🟠 P1 |
| 515 | 配置 Snyk 依赖安全扫描 | 🟠 P1 |

### 监控与告警

| # | 任务 | 优先级 |
|---|------|--------|
| 516 | 编写 Grafana Dashboard（API 网关概览） | 🟠 P1 |
| 517 | 编写 Grafana Dashboard（业务服务指标） | 🟠 P1 |
| 518 | 编写 Grafana Dashboard（AI 服务指标） | 🟠 P1 |
| 519 | 配置 Prometheus 告警规则（5xx 错误率、高延迟） | 🟠 P1 |
| 520 | 配置 AlertManager（告警路由：Slack/PagerDuty） | 🟠 P1 |
| 521 | 配置 Loki 日志聚合 | 🟢 P2 |
| 522 | 配置 OpenTelemetry Collector | 🟢 P2 |
| 523 | 配置 Uptime 监控（UptimeRobot） | 🟠 P1 |

---

## 8.7 测试策略（#524 - #600）

| # | 任务 | 优先级 |
|---|------|--------|
| 524 | 编写测试策略文档 | 🟠 P1 |
| 525 | 为 web-portal 配置 Vitest | 🔴 P0 |
| 526 | 为 shared packages 配置 Vitest | 🔴 P0 |
| 527 | 为 web-portal 配置 Playwright E2E | 🟠 P1 |
| 528 | 配置 MSW（Mock Service Worker） | 🟠 P1 |
| 529 | 编写 api-gateway 中间件表格驱动测试 | 🔴 P0 |
| 530 | 编写 auth-service JWT 单元测试 | 🔴 P0 |
| 531 | 编写 auth-service gRPC 接口测试 | 🟠 P1 |
| 532 | 为 core-service 配置 Testcontainers | 🟠 P1 |
| 533 | 编写 core-service 聚合根业务规则测试 | 🔴 P0 |
| 534 | 编写 core-service REST API 集成测试 | 🟠 P1 |
| 535 | 编写 workflow-engine DAG 解析测试 | 🔴 P0 |
| 536 | 编写 workflow-engine 状态机迁移测试 | 🔴 P0 |
| 537 | 编写 knowledge-base 分块算法单元测试 | 🔴 P0 |
| 538 | 编写 knowledge-base 混合检索对比测试 | 🟠 P1 |
| 539 | 编写 agent-platform Planner 输出解析测试 | 🔴 P0 |
| 540 | 编写 agent-platform Tool 调用链测试 | 🟠 P1 |
| 541 | 配置 Pact Contract Testing | 🟠 P1 |
| 542 | 编写性能压测脚本（k6） | 🟢 P2 |
| 543 | 配置 CI 覆盖率门禁（前端/后端 ≥ 80%） | 🟠 P1 |

---

## 8.8 安全与数据库（#544 - #650）

### 安全

| # | 任务 | 优先级 |
|---|------|--------|
| 544 | 实现 HTTPS 强制跳转（Ingress 注解） | 🔴 P0 |
| 545 | 配置 HSTS / CSP / X-Frame-Options Header | 🟠 P1 |
| 546 | 实现 CSRF 保护（Double Submit Cookie） | 🔴 P0 |
| 547 | 实现登录失败次数限制（Redis 计数，5 次锁定 15 分钟） | 🔴 P0 |
| 548 | 实现敏感数据日志脱敏 | 🔴 P0 |
| 549 | 配置 Pod Security Standard（Restricted） | 🟠 P1 |
| 550 | 配置 K8s RBAC（ServiceAccount 最小权限） | 🟠 P1 |
| 551 | 配置 PostgreSQL 连接 SSL 强制 | 🟠 P1 |
| 552 | 配置 S3 桶默认私有，预签名 URL TTL 15 分钟 | 🔴 P0 |
| 553 | 配置 GitLeaks（防止密钥提交） | 🔴 P0 |
| 554 | 编写安全测试用例（OWASP Top 10） | 🟠 P1 |

### 数据库

| # | 任务 | 优先级 |
|---|------|--------|
| 555 | 设计 auth 数据库 Schema | 🔴 P0 |
| 556 | 设计 core 数据库 Schema | 🔴 P0 |
| 557 | 设计 workflow 数据库 Schema | 🔴 P0 |
| 558 | 设计 knowledge 数据库 Schema | 🔴 P0 |
| 559 | 设计其余服务 Schema（notification/file/agent） | 🟠 P1 |
| 560 | 为所有高频查询字段添加 Index | 🔴 P0 |
| 561 | 为全文搜索字段配置 GIN Index | 🟠 P1 |
| 562 | 实现软删除（`deleted_at` 字段） | 🔴 P0 |
| 563 | 实现审计字段（created_at/updated_at/created_by） | 🔴 P0 |
| 564 | 配置 HikariCP / SQLAlchemy 连接池参数 | 🟠 P1 |
| 565 | 配置 PostgreSQL 慢查询日志 | 🟠 P1 |
| 566 | 实现数据库备份策略（pg_dump + S3，每日） | 🟠 P1 |
| 567 | 编写数据库迁移回滚脚本 | 🟠 P1 |
| 568 | 实现数据库 Schema 版本锁 | 🟠 P1 |

---

## 8.9 文档与运营（#651 - #750）

### 文档

| # | 任务 | 优先级 |
|---|------|--------|
| 651 | 初始化 docs/（Docusaurus 3） | 🔴 P0 |
| 652 | 配置 `docusaurus.config.ts` | 🔴 P0 |
| 653 | 配置 Algolia DocSearch | 🟠 P1 |
| 654 | 编写 getting-started 三篇文档 | 🔴 P0 |
| 655 | 编写 architecture/ 五篇文档 | 🟠 P1 |
| 656 | 编写 guides/ 七篇文档 | 🟠 P1 |
| 657 | 编写 operations/ 五篇运维手册 | 🟠 P1 |
| 658 | 编写 ADR 001-006 | 🔴 P0 |
| 659 | 创建各服务 OpenAPI YAML 初始版本 | 🔴 P0 |
| 660 | 配置 Spectral Lint（CI 合规检查） | 🟠 P1 |
| 661 | 配置 Prism Mock Server | 🟠 P1 |
| 662 | 配置 docs 站点 CI 自动发布 | 🟠 P1 |
| 663 | 绘制架构 Mermaid 图（服务关系、数据流、状态机） | 🟠 P1 |

### 运营

| # | 任务 | 优先级 |
|---|------|--------|
| 664 | 制定 SLA 目标（99.9% 可用性，P95 < 500ms） | 🟠 P1 |
| 665 | 建立故障级别定义（P0/P1/P2/P3） | 🟠 P1 |
| 666 | 建立 On-Call 轮值制度 | 🟠 P1 |
| 667 | 建立 Postmortem 流程 | 🟠 P1 |
| 668 | 配置 PagerDuty / OpsGenie 告警路由 | 🟠 P1 |
| 669 | 实现 Feature Flag（灰度发布） | 🟢 P2 |
| 670 | 配置 Canary Release 策略 | 🟢 P2 |
| 671 | 实现 Blue/Green 部署回滚脚本 | 🟠 P1 |
| 672 | 实现 API Deprecation 策略 | 🟢 P2 |

---

## 8.10 功能扩展（#673 - #780）

| # | 任务 | 优先级 |
|---|------|--------|
| 673 | 实现任务甘特图视图 | 🟢 P2 |
| 674 | 实现项目成员邀请（邮件链接） | 🟠 P1 |
| 675 | 实现 @提及功能 | 🟢 P2 |
| 676 | 实现项目模板功能 | 🟢 P2 |
| 677 | 实现工作流模板市场 | 🟢 P2 |
| 678 | 实现任务批量操作 | 🟠 P1 |
| 679 | 实现全局搜索（跨项目/任务/文档） | 🟠 P1 |
| 680 | 实现数据导出（CSV/Excel/PDF） | 🟢 P2 |
| 681 | 实现 Webhook 对外推送（Slack/企微） | 🟠 P1 |
| 682 | 实现 MCP Server（外部 Agent 工具接入） | 🟢 P2 |
| 683 | 实现 AI 每日工作总结生成 | 🟢 P2 |
| 684 | 实现智能任务分解（AI 拆解大任务） | 🟢 P2 |
| 685 | 实现 GitHub 仓库集成（Webhook → 任务联动） | 🟢 P2 |
| 686 | 实现 AI Code Review GitHub App | 🟢 P2 |
| 687 | 实现知识库问答侧边栏 Copilot | 🟢 P2 |
| 688 | 实现时间追踪（任务计时器） | 🟢 P2 |
| 689 | 实现工作报告自动生成（周报/月报） | 🟢 P2 |
| 690 | 实现 SSO（SAML 2.0 / OIDC） | 🟢 P2 |
| 691 | 实现 Multi-Tenancy（多租户隔离） | 🟢 P2 |
| 692 | 实现 IP 访问控制（企业 IP 白名单） | 🟢 P2 |
| 693 | 实现行级安全策略（PostgreSQL RLS） | 🟢 P2 |
| 694 | 实现 Agent 评分与反馈 | 🟢 P2 |
| 695 | 实现 Agent 推理过程展示（CoT 可见性） | 🟢 P2 |
| 696 | 实现多模态输入（图片 + 文字） | 🟢 P2 |
| 697 | 实现自定义 Agent 创建 | 🟢 P2 |
| 698 | 实现 Plugin System（第三方插件接入框架） | ⚪ P3 |
| 699 | 实现 Knowledge Graph（知识图谱可视化） | ⚪ P3 |
| 700 | 实现实时协同编辑（Yjs CRDT） | ⚪ P3 |

---

## 8.11 数据合规与自动化工具（#701 - #780）

### 数据合规

| # | 任务 | 优先级 |
|---|------|--------|
| 701 | 实现 GDPR 数据删除接口 | 🟠 P1 |
| 702 | 实现用户数据导出（数据可携带权） | 🟠 P1 |
| 703 | 实现隐私政策版本管理 | 🟠 P1 |
| 704 | 实现用户数据访问日志 | 🟠 P1 |
| 705 | 编写数据保留策略文档 | 🟠 P1 |

### 自动化工具

| # | 任务 | 优先级 |
|---|------|--------|
| 706 | 编写代码库健康度统计脚本 | 🟢 P2 |
| 707 | 编写依赖版本同步脚本 | 🟠 P1 |
| 708 | 编写 OpenAPI Spec 合并工具 | 🟠 P1 |
| 709 | 编写服务依赖关系图生成器 | 🟢 P2 |
| 710 | 配置 Auto-tagging（Semantic Version） | 🟢 P2 |
| 711 | 编写 License 合规检查脚本 | 🟠 P1 |
| 712 | 配置 Auto-assign PR Reviewers（CODEOWNERS） | 🟠 P1 |
| 713 | 配置 Stale Bot（自动关闭超时 PR/Issue） | 🟢 P2 |
| 714 | 实现 API Breaking Change 影响分析（PR 自动注释） | 🟢 P2 |

---

## 8.12 性能优化（#715 - #780）

| # | 任务 | 优先级 |
|---|------|--------|
| 715 | 实现 API 响应缓存（Redis，Cache-Control 策略） | 🟠 P1 |
| 716 | 实现 core-service 热点数据二级缓存（Caffeine + Redis） | 🟠 P1 |
| 717 | 配置前端静态资源 CDN（CloudFront/CloudFlare） | 🟠 P1 |
| 718 | 实现 Dataloader 解决 N+1 问题 | 🟠 P1 |
| 719 | 实现 Kafka 消费者批量消费 | 🟠 P1 |
| 720 | 优化 Qdrant HNSW 参数（ef_construct/m） | 🟠 P1 |
| 721 | 实现向量嵌入批量化 | 🔴 P0 |
| 722 | 实现 Agent LLM 调用缓存 | 🟢 P2 |
| 723 | 配置 K8s Resource Limit 合理值 | 🟠 P1 |
| 724 | 配置 JVM GC 参数（G1GC 容器感知） | 🟠 P1 |
| 725 | 实现大文件分片断点续传 | 🟠 P1 |
| 726 | 实现前端 Virtual Scroll（长列表优化） | 🟠 P1 |
| 727 | 配置 Brotli 压缩（CDN + Ingress） | 🟢 P2 |

---

## 8.13 集成测试与发布（#728 - #780）

| # | 任务 | 优先级 |
|---|------|--------|
| 728 | 完成所有服务跨服务联调测试 | 🔴 P0 |
| 729 | 完成 Agent → KB → core-service 端到端测试 | 🔴 P0 |
| 730 | 完成 workflow → Agent → 通知推送端到端测试 | 🔴 P0 |
| 731 | 完成文件上传 → 自动索引 → 可检索端到端测试 | 🟠 P1 |
| 732 | 进行压力测试（k6，100/500/1000 并发） | 🟠 P1 |
| 733 | 进行 Agent 并发任务压测 | 🟠 P1 |
| 734 | 进行知识库大规模索引测试（10000+ 文档） | 🟠 P1 |
| 735 | 修复所有 P0 Bug | 🔴 P0 |
| 736 | 生产环境数据库迁移预演（Dry Run） | 🔴 P0 |
| 737 | 首次生产部署（蓝绿，保留旧版 24h） | 🔴 P0 |
| 738 | 生产部署后 24h 监控值班 | 🔴 P0 |
| 739 | 发布后 Retrospective | 🟠 P1 |
| 740 | 更新所有文档（反映实际发布状态） | 🟠 P1 |

---

## 8.14 后续迭代功能（#741 - #1020）

| # | 任务 | 优先级 |
|---|------|--------|
| 741 | auth-service：实现 API Key 管理（第三方集成） | 🟠 P1 |
| 742 | auth-service：实现多因素认证（TOTP） | 🟢 P2 |
| 743 | auth-service：实现登录设备管理 | 🟢 P2 |
| 744 | core-service：实现项目进度统计 API | 🟢 P2 |
| 745 | core-service：实现任务依赖关系（前置任务） | 🟢 P2 |
| 746 | core-service：实现活动流（Activity Feed） | 🟠 P1 |
| 747 | core-service：实现乐观锁（防并发修改冲突） | 🟠 P1 |
| 748 | core-service：实现自定义字段 | 🟢 P2 |
| 749 | workflow-engine：实现版本管理（快照 + 回滚） | 🟢 P2 |
| 750 | workflow-engine：实现条件表达式（JSONPath） | 🟠 P1 |
| 751 | workflow-engine：实现超时全局配置 | 🟠 P1 |
| 752 | workflow-engine：实现失败重试（指数退避） | 🟠 P1 |
| 753 | workflow-engine：实现工作流暂停/继续 | 🟠 P1 |
| 754 | file-service：实现文件版本控制 | 🟢 P2 |
| 755 | file-service：实现文件分享链接 | 🟢 P2 |
| 756 | file-service：实现文件在线预览 | 🟢 P2 |
| 757 | knowledge-base：实现权限控制（项目级隔离） | 🟠 P1 |
| 758 | knowledge-base：实现文档引用溯源 | 🟠 P1 |
| 759 | knowledge-base：实现增量索引（只更新变更文档） | 🟠 P1 |
| 760 | knowledge-base：实现多语言检索（中英文混合） | 🟢 P2 |
| 761 | agent-platform：实现 Agent 执行日志导出 | 🟢 P2 |
| 762 | agent-platform：实现多模态输入（图片 + 文字） | 🟢 P2 |
| 763 | agent-platform：实现知识注入（运行时注入上下文） | 🟠 P1 |
| 764 | 整体：完善所有服务 README 文档 | 🔴 P0 |
| 765 | 整体：OpenTelemetry 链路追踪全覆盖 | 🟠 P1 |
| 766 | 整体：实现深色模式 | 🟢 P2 |
| 767 | 整体：实现 PWA 支持 | 🟢 P2 |
| 768 | 整体：无障碍访问（WCAG 2.1 AA） | 🟢 P2 |
| 769 | 整体：进行安全红队测试（渗透测试） | 🟠 P1 |
| 770 | 整体：进行第三方代码审计 | 🟢 P2 |
| 771~1020 | 持续功能迭代、性能调优、生态扩展…（详见 backlog） | 🟢 P2 / ⚪ P3 |

---

## 统计汇总

| 模块 | P0 | P1 | P2/P3 | 合计 |
|------|----|----|-------|------|
| 工作空间初始化 | 15 | 20 | 15 | 50 |
| 共享包层 | 38 | 47 | 30 | 115 |
| 前端应用层 | 42 | 63 | 52 | 157 |
| 后端服务层 | 78 | 82 | 28 | 188 |
| AI 能力层 | 36 | 50 | 14 | 100 |
| 基础设施/CI/CD | 42 | 68 | 18 | 128 |
| 测试/安全/数据库 | 22 | 58 | 12 | 92 |
| 文档/运营/扩展 | 8 | 42 | 140 | 190 |
| **合计** | **~281** | **~430** | **~309** | **~1020** |

> **MVP 目标**：完成全部 P0 任务（约 281 项），平台具备核心功能可用性。

---

[← 上一章](./07-docs-project.md) · [返回首页 →](./README.md)
