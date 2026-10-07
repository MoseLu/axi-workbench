---
id: axi-docs-zh-projects-blinko
title: Blinko 参考
type: project
status: published
tags: [Axi Docs, 项目, references, reference, inbox, ai-first, tauri, monorepo]
created: 2026-10-07
modified: 2026-10-07
graph-title: Blinko 参考
graph-tags: [Projects, references, inbox]
description: 开源、自托管、AI-first 的卡片式笔记应用。`Blinko` 是一个 Bun + TypeScript monorepo，将 Tauri shell 与 tRPC + Express + Prisma（Postgres）后端配对，依赖 `Mastra` AI 栈与 `Model Context Protocol`（`MCP`），把收件箱本身暴露为 agent 可调用的工具（`upsertBlinkoTool`、`searchBlinkoTool`、`updateBlinkoTool`、`deleteBlinkoTool`、`scheduledTaskTool`、`webSearchTool`、`McpClientManager`）。
project:
  id: blinko
  partition: references
  path: /Volumes/code/workspace/references/short-term/blinko
  source-section: reference
---

# Blinko 参考

> 工作区项目档案。权威入口：`/Volumes/code/workspace/references/short-term/blinko`。
> 章节：reference / 分区：`references/`。

## 概要

`Blinko` 是一个开源、自托管、AI-first 的卡片笔记应用，自称为"捕捉稍纵即逝的想法或突然的灵感"的栖息地。它以 Bun + TypeScript monorepo 形式分发，组合 Tauri 桌面/移动端 shell 与基于 tRPC + Express + Prisma（Postgres）的后端，并重度依赖 **Mastra AI 栈**与 **Model Context Protocol (MCP)**，把应用内 AI 助手提升为笔记图谱的一等参与者。笔记分为三种离散类型——`BLINKO`（0，瞬时闪念）、`NOTE`（1，长文）、`TODO`（2，追踪任务）——可以加 `#tag`、用过期 URL 公开分享、接入 AI 助手会话、嵌入到 markdown 知识图，或送入向量库做自然语言 RAG 检索。仓库通过 Tauri 声明 macOS / Windows / Android / Linux 多平台支持，并提供一行 `curl | bash` 的 Docker 安装脚本；生产部署使用 `docker-compose.prod.yml` 搭配 Postgres 14 服务与内嵌的 pg-boss 队列。

对 Axi 来说，Blinko 是最直接可借鉴的 inbox 类参考，因为它解决了一个 Axi 真正关心的问题：**如何让个人 inbox 变得 AI-native，同时不丢掉 inbox 赖以存在的"捕捉速度"？** Blinko 把答案编码在数据模型里：每个 `note` 故意保持极简（`id`、`type`、`content`、`isArchived`、`isRecycle`、`isShare`、`isTop`、`isReviewed`、`metadata`、`accountId`），每个动作都是一个 flag（`isTop`、`isArchived`、`isRecycle`），"AI" 不是独立形态——它是同一行上的列，任何查询都能 join 上来（`embeddingUpsert`、`embeddingDelete`、`embeddingInsertAttachments` 见 `server/routerTrpc/ai.ts`）。AI 工具层（`server/aiServer/tools/createBlinko.ts`、`searchBlinko.ts`、`updateBlinko.ts`、`deleteBlinko.ts`、`webSearch.ts`、`scheduledTask.ts`）示范了如何把 inbox 本身暴露为 **agent 可调用工具**：UI 调用的同一套 tRPC 流程，被包装为 Mastra 工具后，AI 助手就能创建、搜索、更新、删除笔记并安排任务。`McpClientManager`（`server/aiServer/mcp/McpClientManager.ts`）把同一思路延伸到外部——助手可以按需与用户配置的 MCP 工具（stdio、SSE 或 streamable-HTTP）通信，闲置 5 分钟自动驱逐。Axi 的 inbox 产品应该照搬这种三类型 schema（闪念/笔记/待办）以及同种的工具包装方式。

第二个价值是 **把 provider 与模型注册表当作数据而不是代码**。Prisma 模型 `aiProviders`、`aiModels`、`mcpServers`（`prisma/schema.prisma` 第 270+ 行）把所有已配置的 provider（OpenAI / Anthropic / Gemini / DeepSeek / OpenRouter / xAI / Azure / Ollama / Voyage）和模型都存在数据库里；`LLMProvider` 类（`server/aiServer/providers/LLMProvider.ts`）只是 `config.provider.toLowerCase()` 上的一个轻量 switch，调用对应的 `@ai-sdk/*` 工厂并返回 `LanguageModelV1`。新增一个 provider 加一行数据库记录 + 一个 `case` 分支即可，无需改动代码。`AiModelFactory.GetProvider()`（`server/aiServer/aiModelFactory.ts`）位于数据库行与 Mastra `Agent` 之间，附带一份每模型维度表供向量库使用（`mxbai-embed-large: 1024`、`nomic-embed-text: 768`、`bge-large-en: 1024`——`aiModelFactory.ts` 第 175-200 行），使同一个 `LibSQLVector` 索引可被多种 embedding 模型复用。Axi 的 `ai-capability` 路由可以采用相同模式：把 provider 持久化为行、在 LLMProvider 中用单一 switch 分派、再把结果作为工具暴露给 agent。

## Stack

`Bun 1.2.8`, `TypeScript`, `Tauri 2.x`, `Vite`, `React 18`, `HeroUI`, `MobX`, `tRPC`, `Express`, `Prisma`, `Postgres 14`, `Mastra`, `MCP`, `pg-boss`, `pg_dump`, `@ai-sdk/*`, `LibSQLVector`, `Vditor`, `Docker`, `Helm`, `trpc-to-openapi`, `JWT`, `OAuth`, `LangChain`

## Milestone Status

| 里程碑 | 状态 | 证据 |
| --- | --- | --- |
| M1 — Inbox schema（BLINKO / NOTE / TODO + JSON metadata） | 已交付 | `prisma/schema.prisma` 第 70-97 行，含 `tagsToNote`、`noteReference`、`noteHistory`、`attachments` 关联 |
| M2 — tRPC 表面（18 个路由器） | 已交付 | `server/routerTrpc/_app.ts` 挂载 `ai`、`notes`、`tags`、`users`、`attachments`、`config`、`public`、`task`、`aiTask`、`analytics`、`comments`、`follows`、`notifications`、`plugin`、`conversation`、`message`、`mcpServers`、`fonts` |
| M3 — AI 助手 + Mastra agent + 八个工具 | 已交付 | `server/aiServer/tools/{createBlinko,createComment,deleteBlinko,scheduledTask,searchBlinko,updateBlinko,webExtra,webSearch}.ts` 注册到 Mastra agent |
| M4 — MCP 客户端（stdio / SSE / streamable-HTTP，5 分钟空闲驱逐） | 已交付 | `server/aiServer/mcp/McpClientManager.ts`，`IDLE_TIMEOUT = 5 * 60 * 1000`、`CLEANUP_INTERVAL = 60 * 1000` |
| M5 — pg-boss 调度器 + cron 驱动的 AI 任务 | 已交付 | `server/jobs/{baseScheduleJob,recommandJob,aiScheduledTaskJob}.ts`；社交信息流每 6 小时刷新 |
| M6 — Tauri shell + 快速捕捉浮动 UI | 已交付 | `app/src/pages/{quicknote,quickai,quicktool}.tsx` + `app/tauri-plugin-blinko`（自定义 Tauri 插件，本地文件系统桥） |
| M7 — 从 tRPC 生成 OpenAPI + 多 provider 鉴权 | 已交付 | `trpc-to-openapi` 配合 `.meta({ openapi })`；`passport-*` 策略覆盖 Apple / Discord / Facebook / GitHub / Google / Line / Slack / Spotify / Twitch / Twitter |
| M8 — 生产 Docker + Helm | 已交付 | `dockerfile`（多阶段 Bun + Node + Vite）、`docker-compose.yml` / `docker-compose.prod.yml`、`helm/` |
| M9 — Axi overlay 文档 | 已交付 | 在 reference repo 根目录完整的 `blinko` overlay 套件 |

## Build & Install

三种安装路径，按本地开发优先级排序：

```bash
# 1. 本地开发（Bun monorepo）
git clone https://github.com/blinko-space/blinko
cd blinko
bun install                                       # workspace 安装
pnpm prisma:generate && pnpm prisma:migrate:dev   # schema bootstrap
pnpm dev                                          # = "cd app && bun run tauri dev"

# 仅前端：
pnpm dev:frontend          # vite dev server，热重载，默认端口 1111

# 仅后端：
pnpm dev:backend           # bun --env-file ../.env --watch index.ts，端口 1111

# 仅构建前端资源（供后端嵌入）：
pnpm build:web

# 2. Docker（贴近生产，一条命令）
docker compose up -d        # Postgres + blinko-website
# 或者规范的 one-liner：
curl -s https://raw.githubusercontent.com/blinko-space/blinko/main/install.sh | bash

# 3. Helm（Kubernetes）
helm install blinko ./helm
```

使用专用的 blinko 类型配置做整仓类型检查：`pnpm build:blinko:types`（`tsc -p tsconfig.blinko.json`）。

仓库要求 `bun >= 1.0.0` 和 `node >= 20.0.0`（在根 `package.json` 的 `engines` 中声明）。Tauri 端瞄准 **Tauri 2.x**（`@tauri-apps/api ^2.5.0`、`@tauri-apps/cli 2.5.0`），附带桌面（`tauri:dev`、`tauri:desktop:build`）与 Android（`tauri:android:dev`、`tauri:android:build`）脚本。

## Architecture Highlights

**Schema 极简，需要灵活之处刻意保持 schema-less。** `notes` 表（`prisma/schema.prisma` 第 70-97 行）只承载 flag：`type`（BLINKO=0、NOTE=1、TODO=2）、`content`、`isArchived`、`isRecycle`、`isShare`、`isTop`、`isReviewed`、`sharePassword`、`shareEncryptedUrl`、`shareExpiryDate`、`shareMaxView`、`shareViewCount`、`metadata`（JSON）、`accountId`、`sortOrder`、时间戳。其它更丰富的内容——到其它笔记的链接、hashtag、附件、AI 摘要、分享审计——要么是关系，要么是 `metadata` 上的 JSON 块。`tagsToNote` 是 `#tag` 提取的连接表；`noteReference`（`@@unique([fromNoteId, toNoteId])`）是支撑 `[[wikilink]]` 解析与 `BlinkoReference` 的有向图。`noteHistory` 用 `version` 计数器保留每个版本，构成"view history"。`follows` 社交图（带 `followType: following|follower`）紧贴在 inbox 之外，因此同一个用户既可以托管一个私人 inbox，又拥有联合的微博。

**类字段上加上 JSON 字段的方式——`Prisma` 中的 `aiProviders` 和 `aiModels` 表就是注册表。** `aiProviders`（第 270 行）持有 `(id, title, provider, baseURL, apiKey, config: Json, sortOrder)`；`aiModels`（在 schema 后面）将能力 flag 存在 JSON 列 `capabilities` 中，通过 Prisma 的 JSON path filter（`path: [capability], equals: true`——`server/aiServer/aiModelFactory.ts` 的 `getAiModelsByCapability`）查询。能力遵循 `app/src/store/aiSettingStore.tsx` 中的 `ModelCapabilities` 接口：`inference`、`tools`、`image`、`imageGeneration`、`video`、`audio`、`embedding`、`rerank`。这意味着单一 `(provider, model)` 行可以被用于八种不同工作中的任何一种，且同一个 Mastra `Agent` 可以在不修改代码的前提下切换后端——agent 只看 `LanguageModelV1`。

**`LLMProvider` 是 `config.provider` 上的轻量 switch。** `server/aiServer/providers/LLMProvider.ts` 接收 `LLMConfig`（`provider`、`apiKey`、`baseURL`、`modelKey`、`apiVersion`），由对应的 `@ai-sdk/*` 工厂（`createOpenAI`、`createAnthropic`、`createGoogleGenerativeAI`、`createOllama`、`createDeepSeek`、`createOpenRouter`、`createXai`、`createAzure`）返回 `LanguageModelV1`。每个 provider 的 `fetch` 都被 `BaseProvider` 中定义的 `this.proxiedFetch` 替换，使得企业级 HTTP 代理可以透明注入。这恰好是 Axi 的 `ai-capability` 路由所需的形态：单一真实来源说明哪个 provider 服务哪个工作，可通过数据库行在运行时切换。

**Mastra 是 agent 运行时；UI 使用的同一套 tRPC 流程就是 agent 工具。** `server/aiServer/aiModelFactory.ts` 用已解析的 `LanguageModelV1` 与一组工具构建 Mastra `Agent`：`upsertBlinkoTool`、`createCommentTool`、`searchBlinkoTool`、`updateBlinkoTool`、`deleteBlinkoTool`、`createScheduledTaskTool`、`deleteScheduledTaskTool`、`listScheduledTasksTool`、`webSearchTool`（Tavily）、`webExtra`，以及任何通过 `getMcpMastraTools` 注册的用户配置 MCP 工具。每个工具都是 `createTool({ id, description, inputSchema: z.object(...), execute })`；以 `upsertBlinkoTool`（`server/aiServer/tools/createBlinko.ts`）为例，`execute` 通过 `userCaller(...)` **反向调用**同一套 tRPC 路由器 upsert 笔记。这意味着 AI 助手从不会绕过 API——它走的是与 UI 相同的代码路径、同样的鉴权。工具的 schema 镜像 UI 的 schema；为其中一方新增一个特性，另一方自动可用。（`searchBlinkoTool`、`updateBlinkoTool` 遵循同一模式。）这是本批所有参考仓库中"inbox 即 agent 记忆"最干净的示范。

**MCP 作为一等用户配置扩展面被接入。** `server/aiServer/mcp/McpClientManager.ts` 是一个单例，懒连接到 `mcpServers` Prisma 表中存储的 MCP 工具，支持 **stdio**、**SSE** 与 **streamable-HTTP** 三种传输，5 分钟空闲窗口（`IDLE_TIMEOUT = 5 * 60 * 1000`）后驱逐连接，并暴露 `getMcpMastraTools`，使任何已注册 MCP 工具的工具都成为 Mastra agent 工具列表的一部分。这与注册表的思路一致：每个工具的配置在数据库中，运行时是一个共享客户端管理器，agent 自动选用。

**流式聊天是 tRPC 生成器 mutation，不是 WebSocket。** `server/routerTrpc/ai.ts` 中的 `completions` 过程（`mutation(async function* ({ input, ctx }) { … })`）先 yield `{ notes }`（RAG 命中列表），再为 `responseStream.fullStream` 的每个 chunk yield `{ chunk }`。客户端 `aiChatBox.tsx` 消费这个迭代器并逐步渲染 markdown。这与 Anthropic / OpenAI 的流式响应形态相同，只不过经 tRPC 的 superjson 路由，使 API 契约类型安全，同一套过程既能跑在 Web UI 上，又能跑在 Tauri shell 里。

**后台任务跑在 `pg-boss` 上，调度本身也存在 Postgres 里。** `server/lib/pgBoss.ts` 把 pg-boss 包装为单例；`server/jobs/baseScheduleJob.ts` 是抽象基类，带 `Start(cronSchedule, ...)`、`Stop()`、`isScheduled()`、`registerWorker()`。具体任务：`ArchiveJob`（把老笔记移到回收站）、`DBJob`（`pg_dump` 备份）、`RebuildEmbeddingJob`（模型切换后重建向量库）、`RecommandJob`（社交信息流每 6 小时刷新，仅在有 following 时才调度——第 36 行 `private static maxConcurrency = 5`、第 41 行 `static async initialize()`）、`AIScheduledTaskJob`（用户用各自 cron 调度的用户自定义提示，通过 `aiScheduledTaskRouter` 暴露）。任务名存在 `shared/lib/sharedConstant.ts`，同一字符串被 worker 与想入队排队的 UI 共享。

**Tauri shell 提供平台原生捕获能力，且不重复逻辑。** `app/src/pages/quicknote.tsx` 用 `isInTauri()` 检测桌面 shell，然后用 `invoke('resize_quicknote_window', { height })` 把浮动捕捉窗口按内容调整大小，100 ms 防抖。页面覆盖 `window.history.pushState` 与 `replaceState`，让浮动捕捉窗口不会跳转。自定义 Tauri 插件 `tauri-plugin-blinko/`（在 `app/package.json` 中以 `file:./tauri-plugin-blinko` 引用）连接桌面运行时与 Web 前端。这个模式——"quick capture" 浮动窗口 + 平台原生快捷键 + Tauri 命令——是实现"打开 app、输入、cmd+enter、关闭"亚秒延迟的关键。

**鉴权通过 `passport-*` 与 `@auth/express` 实现多 provider。** `server/routerExpress/auth/` 注册 Apple、Discord、Facebook、GitHub、Google、Line、Slack、Spotify、Twitch、Twitter 以及本地（用户名/密码）策略。会话用 `express-session` 加 `session` Prisma 模型（`sid`、`data`、`expiresAt`，在 `expiresAt` 上索引）。`verifyToken` 助手（`server/lib/helper.ts`）被 AI 工具复用以认证内部调用——即使是 agent 自己的写入，也走与 UI 相同的 JWT 路径。

**OpenAPI 由同一套 tRPC 路由器生成。** `trpc-to-openapi` 在 `server/index.ts` 中通过 `createOpenApiExpressMiddleware` 注册，`swagger.ts` 构建 OpenAPI 文档并由 `swagger-ui-express` 提供服务。每个 `.meta({ openapi: { method, path, summary, protect, tags } })` 注解都会自动反映——例如 `noteRouter.list`（`server/routerTrpc/note.ts` 第 27 行）声明 `POST /v1/note/list`。这就是 inbox 产品在不写两套路由的前提下，向第三方客户端暴露 API 的方式。

## 说明

- 三类型笔记 schema（`BLINKO` / `NOTE` / `TODO`）+ `notes` 表的 `metadata: Json`；`isArchived` / `isRecycle` / `isShare` / `isTop` / `isReviewed` 都是 `notes` 的列，不另起表。
- provider + 模型注册表放在 Prisma（`aiProviders`、`aiModels`、`mcpServers`）；`LLMProvider.getLanguageModel` 是 `config.provider` 的 switch，返回 `LanguageModelV1`，匹配对应 `@ai-sdk/*` 工厂。
- AI 工具层（`server/aiServer/tools/{createBlinko,createComment,deleteBlinko,scheduledTask,searchBlinko,updateBlinko,webExtra,webSearch}.ts`）通过 `userCaller(...)` 包装 UI 使用的同一套 tRPC 流程；schema 镜像 UI schema，为一方加的特性另一方自动可用。
- `McpClientManager.ts` 中的 MCP 工具生命周期（`IDLE_TIMEOUT = 5 * 60 * 1000`、`CLEANUP_INTERVAL = 60 * 1000`）处理 `stdio`、`SSE`、`streamable-HTTP` 三种传输；`getMcpMastraTools` 把已注册 MCP 工具加入 Mastra agent。
- `aiModelFactory.ts` 第 175-200 行的 embedding 维度表（`mxbai-embed-large: 1024`、`nomic-embed-text: 768`、`bge-large-en: 1024`）让同一个 `LibSQLVector` 索引服务多种 embedding 模型。
- `pg-boss` 任务契约（`baseScheduleJob.ts`）是 `ArchiveJob`、`DBJob`、`RebuildEmbeddingJob`、`RecommandJob`（每 6 小时，条件 `follows.count() > 0`）、`AIScheduledTaskJob`（用户自定义 cron 提示）的模板。
- Tauri 快速捕获 UX：`app/src/pages/quicknote.tsx` 覆盖 `history.pushState`，对 `invoke('resize_quicknote_window', { height })` 做防抖，配合自定义 `tauri-plugin-blinko` 插件提供本地 FS 桥。
- 流式聊天采用 tRPC 生成器 mutation（`ai.ts` 的 `completions`），先 yield `{ notes }` 再 yield `{ chunk }` chunk；同一 procedure 经 superjson 同时服务 Web UI 与 Tauri shell。
- 从 tRPC 生成 OpenAPI（`trpc-to-openapi`）无需第二套路由器就向第三方客户端暴露同一套 API；`.meta({ openapi: { method, path, summary, protect, tags } })` 注解自动反映。

## Cross-References

- 工作区入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Blinko Reference"。
- 项目根目录：`/Volumes/code/workspace/references/short-term/blinko`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/short-term/blinko/AGENTS.md`
- 项目 `README.md`：`/Volumes/code/workspace/references/short-term/blinko/README.md`
- 上游仓库：`https://github.com/blinko-space/blinko`
- **Axi inbox / `axi-inbox`**：三类型笔记 schema（BLINKO / NOTE / TODO）+ 极简 `notes` 表 + `metadata: Json` 是本批最直观的个人 inbox 数据模型。一并把 `isArchived / isRecycle / isShare / isTop / isReviewed` 这一组 flag 一起搬过来——每个 flag 都是 `notes` 上的列，不另起表。
- **Axi `ai-capability` 路由**：复用注册表即 DB 的模式。把 `aiProviders` / `aiModels` 行持久化，使用 JSON 能力 flag；让 `LLMProvider.getLanguageModel` 是 `config.provider` 的 switch，返回 `LanguageModelV1`，匹配 `@ai-sdk/*` 工厂。新增一个 provider 等价于一行 DB 行 + 一个 `case` 分支。
- **Axi MCP 集成**：`McpClientManager` 单例（懒连接 + 空闲驱逐 + 多传输）正是想要的形态。`McpClientManager.ts` 中的 5 分钟空闲超时（`IDLE_TIMEOUT = 5 * 60 * 1000`）加上 1 分钟清理间隔（`CLEANUP_INTERVAL = 60 * 1000`）是可行的默认。
- **Agent 可调用 inbox**：`server/aiServer/tools/createBlinko.ts` 的模式——`createTool({ id, description, inputSchema, execute })` 的 `execute` 通过 `userCaller(...)` 调用 UI 使用的同一套 tRPC 流程——正是 Axi agent 需要的，保证 agent 写入与 UI 写入走完全相同的鉴权、校验、审计路径。
- **流式聊天作为 tRPC 生成器 mutation**：`ai.ts` 的 `completions` yield `{ notes }` 再 yield `{ chunk }` chunk；同种形态可在 Axi 的聊天产品中复用。
- **Tauri 捕获窗口**：`app/src/pages/quicknote.tsx`（覆盖 `history.pushState`、对 `invoke('resize_quicknote_window', { height })` 做防抖）是一套现成的浮动捕获 UX。Axi 的 Mac/Windows 捕获工具可以直接照搬。
- **从 tRPC 生成 OpenAPI**：`trpc-to-openapi` 加上 `.meta({ openapi: { method, path, summary, protect, tags } })` 是在不写第二套路由器的前提下，向第三方客户端暴露 UI 使用的同一套 API 的干净方式。
- **任务调度即数据**：`server/jobs/baseScheduleJob.ts` 与 `AIScheduledTaskJob` 示例展示了如何让用户用各自的 cron 提示定义自动化，存到 `aiScheduledTask`，由 `pg-boss` 运行。Axi 的"用户自定义自动化"特性应当照此实现。
- **embedding 维度表**（`aiModelFactory.ts` 第 175-200 行）是"如何在多种 embedding 模型之间共享同一向量库"最简洁的答案——当 Axi 的 embedding provider 在项目中途切换时非常有用。