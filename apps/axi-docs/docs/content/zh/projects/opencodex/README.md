---
id: axi-docs-zh-projects-opencodex
title: OpenCodex 参考
type: project
status: published
tags: [Axi Docs, 项目, references, reference, codex, computer-use, mcp, macos, gateway]
created: 2026-10-07
modified: 2026-10-07
graph-title: OpenCodex 参考
graph-tags: [Projects, references, codex, computer-use]
description: 本地 Node.js 网关 + macOS 包装应用，解锁 `Codex Desktop` 以接入第三方 API（`MiniMax`、`DeepSeek`、OpenAI 兼容代理），提供 glassmorphic 风格的可切换 provider 仪表盘，并自带 `Computer Use` 引擎，把 macOS 原生鼠标 / 键盘 / 窗口控制暴露为 MCP 工具。仅一个运行时依赖 `@modelcontextprotocol/sdk ^1.6.0`；入口 `src/server.ts`；computer-use 由 `src/cu/actions.ts` + `src/cu/screenshot.ts` 实现；macOS 包装 `scripts/macos-app/OpenCodexApp.swift`；配额感知的 worker 循环 `scripts/minimax-axi-todo-loop.mjs`。
project:
  id: opencodex
  partition: references
  path: /Volumes/code/workspace/references/short-term/opencodex
  source-section: reference
---

# OpenCodex 参考

> 工作区项目档案。权威入口：`/Volumes/code/workspace/references/short-term/opencodex`。
> 章节：reference / 分区：`references/`。

## 概要

`OpenCodex` 是一个本地 Node.js 网关 + macOS 包装应用，解锁 Codex Desktop 以接入第三方 API（MiniMax、DeepSeek、OpenAI 兼容代理），提供 glassmorphic 风格的可切换 provider 仪表盘，并自带 **Computer Use** 引擎，把 macOS 原生鼠标 / 键盘 / 窗口控制暴露为 MCP 工具。它也是本批唯一从一个 TypeScript 构建同时输出两个端用户形态的参考仓库：一个 HTTP/SSE 代理，替代 `chatgpt.com/backend-api/codex` 让 Codex Desktop 与之通信（`src/proxy/index.ts`），以及一个 Swift / WebKit 包装应用（`scripts/macos-app/OpenCodexApp.swift`），启动代理并把仪表盘嵌入到原生 macOS 窗口里。该仓库的招牌集成是 **MiniMax Axi Todo Loop**（`scripts/minimax-axi-todo-loop.mjs`），一个配额门控的 worker 循环，会查询 MiniMax Token Plan 的配额接口、从 `axi-todo` 领取任务、用 `MiniMax-M3` / `MiniMax-M2.7-highspeed` 派发 `codex exec` worker，并在完成后更新 Axi Todo 存储——证明同一个代理既可以驱动交互式 Codex Desktop，也可以在单一鉴权面后面驱动无头 worker 循环。

对 Axi 来说，OpenCodex 是本批其他参考都没覆盖到的三件事的规范参考。第一，它示范了如何在不 fork 既有桌面产品（Codex Desktop）的前提下，在它前面放置一个本地、隔离的代理：代理监听 `OPENCODEX_PORT`（默认 8765），把 `chat.completions` ↔ OpenAI `responses` 进行翻译（`src/proxy/translator.ts`，1181 LOC），把 SSE 日志流式推给仪表盘（`addLog` + `activeSseClients` 在 `proxy/index.ts` 第 76-94 行），并在 context 中写入 Codex 端的文档（`PROJECT_DOC_FALLBACK_FILENAMES = '["CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]'`、`PROJECT_DOC_MAX_BYTES = 65536`——`proxy/index.ts` 第 39-49 行）。第二，它示范了如何在没有重型无障碍框架的前提下，把 macOS 原生原语暴露为 MCP 工具：`src/cu/actions.ts` 把 Swift 脚本写到 `/tmp/oc-act-*.swift`，然后 `spawnSync("/usr/bin/swift", …)` 调用 `CGEvent`（`mouseEventSource`、`mouseType`、`mouseCursorPosition`、`mouseButton`）执行点击/拖拽/滚动/输入/按键/窗口聚焦；`src/cu/screenshot.ts` 对 `CGDisplayCreateImage(CGMainDisplayID())` 做同样的事，必要时回退到 `screencapture`。第三，它示范了如何把 Node 守护进程打包到原生 macOS .app 里——`scripts/build-macos-app.sh` 产出 `dist-macos/OpenCodex.app`，Swift `AppDelegate`（440 LOC）引导 Node 子进程，把 `SIGTERM`/`SIGINT` 通过 `DispatchSource.makeSignalSource` 重定向，轮询 `/health` 直到代理响应，再把仪表盘 URL 加载到 `WKWebView`（尺寸 1180×780，`.titled | .closable | .miniaturizable | .resizable`）。

Axi 自家的 codex 相关形态（`codex-local-gateway-reference`、`codex-computer-use-proxy-reference`、`macos-wrapper-app-reference`）应该把 OpenCodex 当作 state-of-the-art 实现。形态要点是：(a) `BUILTIN_PRESETS`（`src/proxy/presets.ts`）中以代码形式维护的 provider 注册表，带 `auto_api_key` 以便凭证从 CC Switch / `~/.credentials/load-credentials.sh` / 环境变量加载；(b) 通过 `getCodexHome()` / `getNativeCodexHome()` 实现的 Codex home 隔离，加上符号链接的 session 条目（`SHARED_CODEX_SESSION_ENTRIES`——`state_5.sqlite`、`session_index.jsonl`、`history.jsonl`、`sessions/`、`archived_sessions/`、`shell_snapshots/`）；(c) 配额感知的 worker 循环，在 5 小时窗口里通过 `--drain-window --concurrency 3 --max-concurrency 8 --expected-worker-percent 8 --tail-min-remaining-percent 0.5` 排空（`minimax-axi-todo-loop.mjs` 默认值，第 17-24 行）。

## Stack

`Node 18+`, `TypeScript`, `tsc`, `Express-style HTTP/SSE proxy`, `WKWebView`, `Swift (AppDelegate)`, `WebGPU`, `CGEvent`, `CGMainDisplayID`, `screencapture`, `@modelcontextprotocol/sdk ^1.6.0`, `codex exec`, `MiniMax Token Plan`, `CC Switch SQLite`, `load-credentials.sh`, `BUILTIN_PRESETS`, `chat.completions`, `responses`, `dist-macos/OpenCodex.app`

## Milestone Status

| 里程碑 | 状态 | 证据 |
| --- | --- | --- |
| M1 — 前置于 Codex Desktop 的 HTTP/SSE 代理 | 已交付 | `src/proxy/index.ts`（2942 LOC）+ `src/proxy/translator.ts`（1181 LOC）；监听 `OPENCODEX_PORT`（默认 8765） |
| M2 — Glassmorphic 仪表盘 + SSE 日志总线 | 已交付 | `src/proxy/dashboard.ts`（1469 LOC）进程内生成；`addLog` + `activeSseClients` 在 `proxy/index.ts` 第 76-94 行 |
| M3 — Provider 预设表 + 凭证解析链 | 已交付 | `BUILTIN_PRESETS = { native-openai, ccswitch-gpt, minimax, deepseek }`（`src/proxy/presets.ts`）；`resolveProviderApiKey` 按 env → `~/.credentials/load-credentials.sh` → CC Switch SQLite 顺序读取 |
| M4 — Codex home 隔离 + session 存储符号链接 | 已交付 | `ensureCodexLaunchHome()` + `SHARED_CODEX_SESSION_ENTRIES`（`state_5.sqlite`、`session_index.jsonl`、`history.jsonl`、`sessions/`、`archived_sessions/`、`shell_snapshots/`） |
| M5 — MCP 服务器（Computer Use 引擎） | 已交付 | `src/server.ts` 挂载 `MCP Server`，8 个工具：`screenshot`、`click`、`drag`、`scroll`、`page_scroll`、`type_text`、`press_key`、`get_windows`、`focus_window` |
| M6 — Computer Use 引擎（Swift 脚本化） | 已交付 | `src/cu/actions.ts`（225 LOC）+ `src/cu/screenshot.ts`（51 LOC）；`CGEvent` + `CGDisplayCreateImage` + `screencapture` 回退；10-15 秒超时 |
| M7 — macOS 包装 `.app`（Swift + WKWebView） | 已交付 | `scripts/macos-app/OpenCodexApp.swift` `AppDelegate`（440 LOC）；打包 Node 子进程 + 仪表盘 `WKWebView`；`// Codex Plus` 变体在就绪后隐藏窗口 |
| M8 — 每个 Codex turn 的工作区文档注入 | 已交付 | `WORKSPACE_DOC_FILENAMES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]` + `WORKSPACE_DOC_MARKER = "opencodex:workspace-instructions"` |
| M9 — 配额门控的 MiniMax Axi Todo Loop | 已交付 | `scripts/minimax-axi-todo-loop.mjs`（996 LOC）；`--drain-window --concurrency 3 --max-concurrency 8 --expected-worker-percent 8 --tail-min-remaining-percent 0.5` |
| M10 — 可回滚的 Codex provider 注册 | 已交付 | `scripts/enable-aggregate-codex-app.sh`（仅追加）+ `scripts/rollback-codex-app-config.sh` |
| M11 — Axi overlay 文档 | 已交付 | 在 reference repo 根目录完整的 `opencodex` overlay 套件 |

## Build & Install

```bash
# 1. 安装（一个运行时依赖，外加 typescript 与 @types/node 作 devDeps）
git clone https://github.com/AITabby/opencodex.git
cd opencodex
npm install         # postinstall: tsc  → 产出 dist/

# 2. 运行代理 + 仪表盘 + MCP 服务器（默认端口 8765）
npm start           # = NODE_USE_ENV_PROXY=1 node --disable-warning=UNDICI-EHPA dist/server.js

# 3. 可选：仅 HTTP 模式（不暴露 MCP stdio 传输）以适配 launchd
OPENCODEX_HTTP_ONLY=1 npm run start:http

# 4. 可选：把 OpenCodex provider 注册到 Codex Desktop
OPENCODEX_MANAGE_CODEX=1 npm start                              # 修改 ~/.codex/config.toml
# 或者仅注册且可回滚（Codex 仍走原生 GPT）
npm run start:http
OPENCODEX_PORT=8794 OPENCODEX_NO_BROWSER_OPEN=1 scripts/enable-aggregate-codex-app.sh
scripts/rollback-codex-app-config.sh

# 5. 构建 macOS 包装 .app
npm run build:macos                       # 产出 dist-macos/OpenCodex.app
open dist-macos/OpenCodex.app
# 或 Codex Plus 变体：
npm run build:macos:plus                   # 产出 dist-macos/Codex Plus.app
```

Worker 循环用法：

```bash
MINIMAX_TOKEN_PLAN_API_KEY=... npm run minimax:axi-todo-loop -- --once
npm run minimax:axi-todo-loop -- --concurrency 3 --min-remaining-percent 5
npm run minimax:axi-todo-loop -- --drain-window --concurrency 3 --max-concurrency 8 \
  --expected-worker-percent 8 --min-remaining-percent 3 --tail-min-remaining-percent 0.5 \
  --interval-ms 30000
```

校验命令（按 `AGENTS.md`）：

```bash
npm run build
node test_translator.mjs
node scripts/test-macos-readiness.mjs
node scripts/test-codex-project-docs.mjs
```

## Architecture Highlights

**单个 Node 进程拥有三个独立的形态：HTTP 代理、MCP stdio 服务器、仪表盘 SSE 总线。** `src/server.ts`（224 LOC）构造 `ProxyServer(port)`、`ScreenshotTaker`、`ActionPerformer` 以及一个 MCP `Server`（`tools: {}` capability），再把 MCP 服务器连接到 `StdioServerTransport`。MCP 工具列表（`TOOLS`，第 27-118 行）是 8 个条目：`screenshot`、`click`、`drag`、`scroll`、`page_scroll`、`type_text`、`press_key`、`get_windows`、`focus_window`。每个工具分派到同一个 `ActionPerformer` / `ScreenshotTaker` 实例。这是工作区里"computer-use MCP 服务器"最干净的参考——无需 Python、无需独立守护进程、无需 AppleScript 桥。

**代理实时把 OpenAI `chat.completions` ↔ OpenAI `responses` 互译，并把 Codex-native 配置块写入 `~/.codex/config.toml`。** `src/proxy/translator.ts` 导出 `responsesToChat`、`chatCompletionToResponse`、`extractNamespaceMap`、`ResponsesStreamState`、`compressImagesInRequest`、`createStreamingThinkStripper`、`sanitizeChatCompletionPayload`、`sanitizeChatCompletionStreamChunk`。`src/proxy/index.ts`（2942 LOC）在 Codex 端承担重活：`ensureCodexLaunchHome()` 把 `auth.json`、`AGENTS.md`、`models_cache.json`、`version.json`、`.codex-global-state.json` 从 `~/.codex` 同步到隔离的 `~/.opencodex/codex-app-home`（或共享），保留 `# >>> opencodex managed >>> … # <<< opencodex managed <<<` 块（`stripManagedBlocks`、`stripOpenCodexProviderBlock`、`stripTopLevelModelSelection`），把 `skills`、`rules`、`pets` 符号链接，合并 `plugins`、`browser`、`computer-use`，并重写 Codex 启动引用（`rewriteCodexLaunchReferences`）。会话状态通过符号链接表 `SHARED_CODEX_SESSION_ENTRIES`（`state_5.sqlite`、`state_5.sqlite-wal`、`state_5.sqlite-shm`、`session_index.jsonl`、`history.jsonl`、`external_agent_session_imports.json`、`sessions/`、`archived_sessions/`、`shell_snapshots/`）共享——opencodex 不会在每次重启时都拷贝/重写 session 存储，只是符号链接，因此之前的 Codex 线程在多次启动之间保持存活。

**Provider 预设以代码表维护；凭证按优先级从三种来源加载。** `src/proxy/presets.ts` 定义 `BUILTIN_PRESETS = { "native-openai", "ccswitch-gpt", "minimax", "deepseek" }`。`OPENAI_OAUTH_PROVIDER = "native-openai"` 对应 `https://chatgpt.com/backend-api/codex`，带 `auto_api_key: true`。`GPT_PROXY_PROVIDER = "ccswitch-gpt"` 对应 `http://127.0.0.1:15721/v1`（CC Switch 中继）。`minimax` 对应 `https://api.minimaxi.com/v1`，模型为 `MiniMax-M2.7-highspeed`、`MiniMax-M3`。`deepseek` 对应 `https://api.deepseek.com/v1`，模型为 `deepseek-v4-pro`。凭证解析顺序（`resolveProviderApiKey` 中）：显式配置 → 环境变量（`$MINIMAX_API_KEY` 简写语法）→ `~/.credentials/load-credentials.sh`，通过 `zsh -lc 'source "$HOME/credentials/load-credentials.sh"; printf %s "${MINIMAX_API_KEY:-}"'`（第 91-94 行）→ CC Switch SQLite（`sqlite3 ~/.cc-switch/cc-switch.db "SELECT settings_config FROM providers WHERE app_type='codex' AND name='minimax' ORDER BY is_current DESC LIMIT 1;"`，第 175-179 行）。凭证永不入库；加载脚本受信任但从不被执行。

**工作区 + 项目文档被注入到每一个 Codex turn。** `proxy/index.ts` 定义 `DEFAULT_WORKSPACE_ROOT = "/Volumes/code/workspace"`、`WORKSPACE_DOC_MAX_BYTES = 65536`、`WORKSPACE_DOC_FILENAMES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]`，外加 `PROJECT_DOC_FALLBACK_FILENAMES = '["CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]'` 和 `PROJECT_DOC_MAX_BYTES = 65536`。这些配置被写入 Codex 端的 `config.toml`（`project_doc_fallback_filenames = [...]`、`project_doc_max_bytes = 65536`），代理自己读 `WORKSPACE_DOC_MARKER = "opencodex:workspace-instructions"` 来标记注入块。**模型并不读文件**；opencodex 在 turn 之前把文档加载到模型 context 中，使第三方模型（在推断工作流意图方面更弱）也能得到 Codex 原生所看到的合同。这正是正确的 Axi 模式：即使非原生模型也应首先看到 `AGENTS.md`。

**Computer Use 引擎就是"把 Swift 编译到临时文件，调用 `swift` 跑，再返回 stdout"。** `src/cu/actions.ts`（225 LOC）与 `src/cu/screenshot.ts`（51 LOC）把每个 UI 原语实现为 Swift 源码字符串。点击：先 `import Cocoa`，再对 `.leftMouseDown` 与 `.leftMouseUp` 各执行一次 `CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)!.post(tap: .cghidEventTap)`。拖拽：20 步插值，`.leftMouseDragged` 事件之间 `Thread.sleep(forTimeInterval: 0.01)`。截图：`CGDisplayCreateImage(CGMainDisplayID())` → `NSBitmapImageRep` → `rep.representation(using: .png, properties: [:])` → 写入 `/tmp/oc-shot-*.png`，必要时回退到 `/usr/sbin/screencapture -x -t png`。所有临时文件在 `finally` 中 `unlinkSync`。每次调用超时 10-15 秒。**没有无障碍权限弹窗**，没有 `osascript`，没有 Electron——只有 `spawnSync("/usr/bin/swift", ...)`。

**macOS 包装应用是一个 440 LOC 的 Swift 文件，持有 Node 子进程。** `scripts/macos-app/OpenCodexApp.swift` 中 `AppDelegate.applicationDidFinishLaunching` 依次执行：`installMenu()`（一个 Quit 项，keyEquivalent `q`），`installTerminationSignalHandlers()`（`Darwin.signal(SIGTERM, SIG_IGN)` + 对 `SIGTERM`/`SIGINT` 各自 `DispatchSource.makeSignalSource`），`createWindow()`（1180×780，`.titled | .closable | .miniaturizable | .resizable`，居中），`resolveProjectPath()`（先检查 `Bundle.main.resourceURL/project-path.txt`，再检查内置 `opencodex-runtime`，再回退到 `bundleURL.deletingLastPathComponent().deletingLastPathComponent()`），`resolveNodePath()`，`openLogFile()`，`startService()`（派生 Node 子进程并捕获日志句柄），然后 `waitForDashboard()` 每 0.25 秒轮询 `http://127.0.0.1:{port}/health`（80 次后切到 1.0 秒——`readinessWarningAttempt = 80`），一旦 `status: ok && opencodex: true` 就把 `http://127.0.0.1:{port}/dashboard` 加载进 `WKWebView`。Codex Plus 变体（`CODEX_PLUS_APP=1` 或应用名包含 "Codex Plus"）在就绪后隐藏窗口（`window.orderOut(nil)`、`NSApp.hide(nil)`），`applicationShouldTerminateAfterLastWindowClosed` 返回 `false`，菜单栏应用保持存活。

**MiniMax Axi Todo Loop 是一个配额感知的 worker 分派器。** `scripts/minimax-axi-todo-loop.mjs`（996 LOC）实现：`parseArgs` 默认 `DEFAULT_MODEL = "MiniMax-M3"`、`DEFAULT_FALLBACK_MODEL = "MiniMax-M2.7-highspeed"`、`DEFAULT_CODEX_PROVIDER = "opencodex"`、`DEFAULT_CONCURRENCY = 3`、`DEFAULT_MAX_CONCURRENCY = 8`、`DEFAULT_MIN_REMAINING_PERCENT = 5`、`DEFAULT_INTERVAL_MS = 60_000`、`DEFAULT_EXPECTED_WORKER_PERCENT = 8`、`DEFAULT_TAIL_WINDOW_MINUTES = 45`、`DEFAULT_TAIL_MIN_REMAINING_PERCENT = 1`。它通过 `parseMiniMaxQuota` → `preferredIntervalNode` → `percentFromNode` → `resetFromNodes` 查询 `https://api.minimaxi.com/v1/token_plan/remains`（备选 `/v1/api/openplatform/coding_plan/remains` 与 `/v1/coding_plan/remains`）。若 `remainingPercent < minRemainingPercent`，循环等到 reset 后再继续；否则从 `axi-todo`（路径默认 `/Volumes/code/workspace/agent-cluster/axi-agent/tools/axi-todo`）领取任务，并按 `agentRole` / `agentCategory` / `executionMode` 元数据派发 `codex exec` worker（`agentCategory=quick|writing|unspecified-low` → fallback；`deep|ultrabrain|visual-engineering|unspecified-high` 或 `executionMode=plan|consult` → primary）。`--drain-window` 根据当前 5 小时剩余百分比把启动批次往 `--max-concurrency` 缩放。每个 worker 提示词都内嵌 portable operating contract（Axi Todo/PostgreSQL 作为完成事实，`agentmemory` 仅作语义记忆，有限 startup 协议，最终 `Result` / `Files Changed` / `Evidence` / `State Update` / `Memory Card` / `Blockers` 节）。除非传入 `--allow-unknown-quota`，循环默认 fail-closed。

## 说明

- 入口 `src/server.ts`（224 LOC）挂载 `ProxyServer`、`ScreenshotTaker`、`ActionPerformer`，以及一个拥有 8 个工具的 MCP `Server`（`screenshot`、`click`、`drag`、`scroll`、`page_scroll`、`type_text`、`press_key`、`get_windows`、`focus_window`）。
- HTTP/SSE 代理位于 `src/proxy/index.ts`（2942 LOC）；chat.completions ↔ responses 流式翻译器为 `src/proxy/translator.ts`（1181 LOC）（`responsesToChat`、`chatCompletionToResponse`、`extractNamespaceMap`、`ResponsesStreamState`、`compressImagesInRequest`、`createStreamingThinkStripper`、`sanitizeChatCompletionPayload`、`sanitizeChatCompletionStreamChunk`）。
- Glassmorphic 仪表盘是单文件进程内模板 `src/proxy/dashboard.ts`（1469 LOC）；SSE 日志总线使用 `addLog` + `activeSseClients`（第 76-94 行）。
- `src/proxy/presets.ts` 中的 Provider 预设：`BUILTIN_PRESETS = { native-openai, ccswitch-gpt, minimax, deepseek }`；`OPENAI_OAUTH_PROVIDER = "native-openai"` 带 `auto_api_key: true`，`GPT_PROXY_PROVIDER = "ccswitch-gpt"`，`minimax` 模型 `MiniMax-M2.7-highspeed` 和 `MiniMax-M3`，`deepseek` 模型 `deepseek-v4-pro`。
- 凭证解析链：显式配置 → 环境变量（`$MINIMAX_API_KEY` 简写语法）→ `~/.credentials/load-credentials.sh`，通过 `zsh -lc 'source "$HOME/credentials/load-credentials.sh"; printf %s "${MINIMAX_API_KEY:-}"'`（第 91-94 行）→ CC Switch SQLite（`sqlite3 ~/.cc-switch/cc-switch.db "SELECT settings_config FROM providers WHERE app_type='codex' AND name='minimax' ORDER BY is_current DESC LIMIT 1;"`，第 175-179 行）。
- Codex home 隔离：`ensureCodexLaunchHome()` 把 `auth.json`、`AGENTS.md`、`models_cache.json`、`version.json`、`.codex-global-state.json` 同步进 `~/.opencodex/codex-app-home`；managed-block 标记 `# >>> opencodex managed >>> … # <<< opencodex managed <<<` 由 `stripManagedBlocks`、`stripOpenCodexProviderBlock`、`stripTopLevelModelSelection` 保留。
- Session 存储符号链接表 `SHARED_CODEX_SESSION_ENTRIES`：`state_5.sqlite`、`state_5.sqlite-wal`、`state_5.sqlite-shm`、`session_index.jsonl`、`history.jsonl`、`external_agent_session_imports.json`、`sessions/`、`archived_sessions/`、`shell_snapshots/`。
- 工作区文档注入：`WORKSPACE_DOC_FILENAMES = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]` + `WORKSPACE_DOC_MAX_BYTES = 65536` + `PROJECT_DOC_FALLBACK_FILENAMES = '["CLAUDE.md", "CODEX.md", "INSTRUCTIONS.md"]'`；代理把 `WORKSPACE_DOC_MARKER = "opencodex:workspace-instructions"` 写进注入块。
- Computer Use 引擎：`src/cu/actions.ts`（225 LOC）把 Swift 写到 `/tmp/oc-act-*.swift`，然后 `spawnSync("/usr/bin/swift", ...)`；`CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left).post(tap: .cghidEventTap)` 同时覆盖 `.leftMouseDown` 与 `.leftMouseUp`；每次调用 10-15 秒超时；临时文件在 `finally` 中 `unlinkSync`。
- 截图：`src/cu/screenshot.ts`（51 LOC）；`CGDisplayCreateImage(CGMainDisplayID())` → `NSBitmapImageRep` → `rep.representation(using: .png, properties: [:])` → `/tmp/oc-shot-*.png`；必要时回退到 `/usr/sbin/screencapture -x -t png`。
- macOS 包装：`scripts/macos-app/OpenCodexApp.swift` `AppDelegate`（440 LOC）；1180×780 `WKWebView`（`.titled | .closable | .miniaturizable | .resizable`）；`Darwin.signal(SIGTERM, SIG_IGN)` + `DispatchSource.makeSignalSource`；`/health` 每 0.25 秒轮询，`readinessWarningAttempt = 80`。
- Codex Plus 变体（`CODEX_PLUS_APP=1` 或应用名包含 "Codex Plus"）在就绪后隐藏窗口（`window.orderOut(nil)`、`NSApp.hide(nil)`），`applicationShouldTerminateAfterLastWindowClosed` 返回 `false`。
- Worker 循环 `scripts/minimax-axi-todo-loop.mjs`（996 LOC）；默认值 `DEFAULT_MODEL = "MiniMax-M3"`、`DEFAULT_FALLBACK_MODEL = "MiniMax-M2.7-highspeed"`、`DEFAULT_CODEX_PROVIDER = "opencodex"`、`DEFAULT_CONCURRENCY = 3`、`DEFAULT_MAX_CONCURRENCY = 8`；查询 `https://api.minimaxi.com/v1/token_plan/remains`（备选 `/v1/api/openplatform/coding_plan/remains` 与 `/v1/coding_plan/remains`）。
- 可回滚 provider 注册：`scripts/enable-aggregate-codex-app.sh`（仅追加，从不动 `model_provider` / `model_catalog_json`）+ `scripts/rollback-codex-app-config.sh`。
- 构建：`scripts/build-macos-app.sh` 产出 `dist-macos/OpenCodex.app`（`--flavor codex-plus` 产出 Codex Plus 变体）。
- 单一运行时依赖：`@modelcontextprotocol/sdk ^1.6.0`（见 `package.json`）；根 `type: "module"`；生产入口 `node --disable-warning=UNDICI-EHPA dist/server.js`，用于在激进的 chunked 流式期间静默 undici 的 "headers already sent" 警告。

## Cross-References

- 工作区入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "OpenCodex Reference"。
- 项目根目录：`/Volumes/code/workspace/references/short-term/opencodex`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/short-term/opencodex/AGENTS.md`
- 项目 `README.md`：`/Volumes/code/workspace/references/short-term/opencodex/README.md`
- 上游仓库：`https://github.com/AITabby/opencodex`
- **Axi Codex-local-gateway 参考**（`codex-local-gateway-reference`）：照搬 `BUILTIN_PRESETS` 中的 provider-注册表-即表设计、`resolveProviderApiKey` 中的 CC Switch + `~/.credentials/load-credentials.sh` + 环境变量凭证解析链、`ensureCodexLaunchHome` 中的 Codex home 隔离（`getCodexHome` / `getNativeCodexHome`）、managed-blocks 模式（`# >>> opencodex managed >>> … # <<< opencodex managed <<<` 与 `stripManagedBlocks` / `stripOpenCodexProviderBlock` / `stripTopLevelModelSelection`）、session 存储符号链接表 `SHARED_CODEX_SESSION_ENTRIES`。这四块正是"在 Codex Desktop 前放代理而不 fork"的正确形态。
- **Axi Codex-computer-use-proxy 参考**（`codex-computer-use-proxy-reference`）：8 个 MCP 工具（`screenshot`、`click`、`drag`、`scroll`、`page_scroll`、`type_text`、`press_key`、`get_windows`、`focus_window`）+ `ActionPerformer` + `ScreenshotTaker` 的 Swift 源码生成器是 minimum viable 的 computer-use MCP server。无需无障碍框架或 Electron 宿主；`spawnSync("/usr/bin/swift", ["/tmp/oc-act-{Date.now()}.swift"])` 就够。临时文件生命周期（`writeFileSync` → `spawnSync` → 在 `finally` 中 `unlinkSync`）与 10-15 秒超时是合理的默认。
- **Axi macOS-wrapper-app 参考**（`macos-wrapper-app-reference`）：`AppDelegate` 形态（1180×780 `WKWebView`，通过 `Darwin.signal(SIGTERM, SIG_IGN)` + `DispatchSource.makeSignalSource` 捕获信号，`/health` 轮询循环，80 次警告阈值，项目路径解析走 `Bundle.main.resourceURL/project-path.txt` → 内置 `opencodex-runtime` → 仓库父级）正是任何"Mac 应用持有本地守护进程并嵌入其仪表盘"的正确形态。Codex Plus 变体（`CODEX_PLUS_APP=1`、`applicationShouldTerminateAfterLastWindowClosed` 返回 `false`、就绪后隐藏窗口）是菜单栏 / 常驻变体的正确模式。
- **Axi 工作区文档注入**：`WORKSPACE_DOC_FILENAMES` 表 + `WORKSPACE_DOC_MAX_BYTES` + `WORKSPACE_DOC_MARKER`（让代理在 `config.toml` 中定位自己注入块的标记注释），是强制"工作区中每个 Codex turn 都能看到 AGENTS.md + 备选文档"的最干净方式。任何其他 agent 形态都应采用。
- **Axi 配额门控的 worker 循环**：`minimax-axi-todo-loop.mjs` 的形态——查询配额、解析为 `remainingPercent` + `reset`、仅在 `remainingPercent >= minRemainingPercent` 时领取任务、用 `--drain-window` 缩放并发、fail-closed 除非加入 `--allow-unknown-quota`、在每个 worker 提示词中嵌入 portable operating contract、要求最终答复带 `Evidence` 节——应当作为任何 Axi 委派给付费模型的循环模板。
- **Axi 流式翻译**：`responsesToChat` / `chatCompletionToResponse` 加上 `compressImagesInRequest` + `createStreamingThinkStripper` 是任何"由单一 Codex 风格客户端与多个模型 API 对话的代理"的可复用构件。
- **可回滚 provider 注册**：`enable-aggregate-codex-app.sh`（仅追加，从不动 `model_provider` / `model_catalog_json`）+ `rollback-codex-app-config.sh` 是任何"在 Codex Desktop 中注册 provider 而不接管它"的干净模板。