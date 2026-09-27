---
id: axi-docs-zh-plans-knowledge-hub-stability
title: 知识中枢稳态化方案
type: plan
status: draft
tags: [Axi Docs, 方案, 知识中枢, 稳态, owner-action, mcp, vite, 安全]
created: 2026-06-13
modified: 2026-06-13
graph-title: 知识中枢稳态化方案
graph-tags: [Axi Docs, 方案, 稳态]
description: 通过消除同步 I/O、强制 CORS 白名单、抽取 Vite/MCP 重复 helper，让 Axi 知识中枢运行时进入稳态。底稿来自 todo/04-roadmap.md「下一轮重点」与 todo/02-legacy-audit.md 的 owner action 表。
---

# 知识中枢稳态化方案

## 目标结果（Outcome）

本方案落地后必须满足三条事实：

1. `app/src/mcp/server.ts` 在热路径（HTTP 请求处理、MCP 工具分发、知识源索引）上不再出现 `readFileSync` / `writeFileSync` / `readdirSync`；所有文件访问走 `fs.promises`。
2. MCP server 与 Vite 插件的 CORS 都按 `ALLOWED_ORIGINS` 的严格白名单生效。`ALLOWED_ORIGINS` 为空 / 未设置时，跨域请求一律拒绝，不再静默回显请求源。
3. `vite.config.plugin.ts` 与 `app/src/mcp/server.ts` 复用的 helper（文件扫描、tag 提取、搜索、图谱构建、Blinko 代理、CORS 白名单）集中在 `app/src/lib/` 下一棵模块树里，并带单测；两个调用方收缩为薄适配层。

## 背景（Context）

源文档：

- `todo/04-roadmap.md` ——「下一轮重点」列出三项 owner action：同步 I/O 改造、CORS 白名单强制、Vite/MCP 重复抽取。2026-06-04 更新把这三块标为 ZC-DOCS-001~005 之后的下一轮迭代。
- `todo/02-legacy-audit.md` —— 2026-03 审计 P0 PERF、P1 SECURITY/CORS/PERF 跟踪的就是这三项。

代码现状（2026-06-13 核实）：

- `app/src/mcp/server.ts` 2096 行、`app/vite.config.plugin.ts` 423 行；`04-roadmap.md`「~2000 行重复」的说法夸大了文件级重复；真实重复在 `server.ts` 内部 helper 群 + Vite 插件里三处手写 CORS 分支。
- `server.ts` 同步 I/O 共 4 处：启动时 `.env` 读取（19–20 行）、token 文件读取（1353–1354 行）、token 文件写入（1360 行）、`dist/index.html` 存在性检查（1680 行）。前两处是冷路径 / 一次性；`dist/index.html` 存在性检查在每请求命中失败时执行一次。
- `server.ts` 的 CORS 已经通过 `getAllowedOrigin()`（1375 行）正确解析，三处响应分支（1487、1532、1663）都用了 `origin` 变量。Vite 插件里还有 3 处硬编码 `*`（223、286、340 行）。`ALLOWED_ORIGINS` 默认空，空值时 `getAllowedOrigin` 回显请求源（1380 行）—— 这就是缺口。

## Grill 结论（Grill Findings）

- 假设：生产部署从一个稳定、有限的白名单（如 `https://docs.axi.local`）访问。空白名单是「配置错误」，不应被解读为「全部信任」。
- 约束：MCP 工具公开面（`axi_docs_*` JSON 形状）和 Vite 开发服务器路由不能改。重构范围限定在 `app/src/` 内部。
- 约束：`app/vite.config.plugin.ts` 跑在 Vite Node 上下文，不能 import `app/src/` 里的浏览器代码。共享 helper 必须保持 Node 安全。
- 已拒绝：把文件扫描用 Rust / native addon 重写。投入产出比不对，`fs.promises` 路径已经够用。
- 已拒绝：彻底去掉 CORS（仅同源）。MCP server 设计目标就是让独立 docs 站和本地 agent（`http://localhost:3005`）能跨域访问。
- 开放风险：现有重复 helper 群部分缺测。抽取时必须先补测，再切，否则会丢行为覆盖。
- 开放风险：Vite 插件直接 `import 'node:fs'` / `'node:path'`。CORS 抽成共享模块后，要确认 Vite dev server 解析共享路径的方式与生产 server 一致。

## 落地计划（Landing Plan）

三阶段。每阶段都是稳定的停止点；前阶段不能被后阶段破坏。

### 阶段 1 — CORS 加固（最小、安全价值最高）

1. 把 `getAllowedOrigin` 和 `ALLOWED_ORIGINS` 解析从 `app/src/mcp/server.ts` 抽到新模块 `app/src/lib/cors.ts`。严格语义：空白名单视为拒绝（返回空串或由响应层转成「不下发 CORS 头」的哨兵值）。
2. `server.ts` 三处响应分支改用共享模块。
3. `app/vite.config.plugin.ts` 三处响应分支也改用同一模块。Vite 端读 `VITE_AXI_ALLOWED_ORIGINS`，回退到 `ALLOWED_ORIGINS`。
4. `.env.example` 给本地开发一个非空的默认白名单（如 `http://localhost:3005`）。
5. 单测：
   - 空白名单 → 响应里没有 `Access-Control-Allow-Origin` 头。
   - 匹配 origin → 头回显。
   - 不匹配 origin → 头为空（或缺失），响应码仍按路由正常（不要 403 拦截 preflight，因为路由本身可能需要回 200/4xx）。
6. 验证：`pnpm --dir app verify`；手动 `curl -H "Origin: https://evil.example" -i` 跑 dev server，确认响应里不会出现 `Access-Control-Allow-Origin: https://evil.example`。

### 阶段 2 — 同步 I/O → 异步（中等规模，性能 + 可靠性）

1. 新增 `app/src/lib/fsAsync.ts`，用项目统一的错误日志封装 `fs.promises`。
2. 替换 `server.ts` 4 处同步调用：
   - 启动时 `.env` 读取 → 保留同步（一次性启动读、不在热路径）。补一行注释说明决策。
   - token 文件读取 → 改 `fs.promises.readFile`。`loadOrCreateToken` 出 async 版；同步版在 event loop 第一个 tick 内调 async 版（启动期一次性，可接受）。
   - token 文件写入 → 改 `fs.promises.writeFile`，保留 `mode: 0o600`。
   - 每请求 `dist/index.html` 存在性检查 → 启动期缓存为布尔值（`dist/` 不会在 server 生命周期内变化）。文档化失效契约：替换 `dist/` 必须重启 server。
3. 加一个单测：加载 token 文件 → 删除 → 验证下次调用会重新生成（覆盖「读不到就建」的分支）。
4. 验证：`pnpm --dir app test:run`；`pnpm --dir app verify`；在大型 Obsidian vault 下 smoke dev server，确认工具分发延迟不抖（MVP 不做正式 benchmark）。

### 阶段 3 — 共享 helper 抽取（最大，依赖阶段 1 + 2）

1. 识别 `app/src/mcp/server.ts` 里的重复 helper：tag 提取（`extractTagsFromContent`）、frontmatter 构造（`buildFrontmatter`）、label 提取（`extractLabel`）、源扫描器（`excludePatterns` / `supportedExtensions` / `isExcluded` / `isHiddenDir` / `isSupported` 块）、`resolveSource` 查找、Blinko 代理包装。
2. 抽到 `app/src/lib/knowledgeBase/`（或在现有模块上扩展），每个 helper 一个测试文件。本阶段保持公开签名稳定。
3. `server.ts` 与 `vite.config.plugin.ts` 都改为 import 共享 helper，两个文件收缩为「解析请求 → 调共享 helper → 响应」的薄路由。
4. 集成测试：同一条 query 分别走 MCP 工具入口和 Vite dev `/api/*` 端点，断言响应 payload 完全一致（不含 CORS 头差异）。
5. 验证：`pnpm --dir app test:run`；`pnpm --dir app verify`；`server.ts` 行数下降 ≥ 30%，`vite.config.plugin.ts` 行数下降 ≥ 20%。

## 排除项（Out of scope）

- Web 阅读器打磨（左侧树、TOC、knowledge catalog 折叠、mobile responsive）→ 留给 `reader-experience-plan.md`。
- 旧审计 P0/P1 owner action 复核流程 → 留给 `legacy-audit-revisit-plan.md`。
- React 性能 memoization、TypeScript `as` 清理、测试覆盖率 CI 门槛、`react-i18next`、结构化日志、Sentry —— 全部走 `todo/02-legacy-audit.md` 跟踪，本方案不复述。

## 执行链接（Execution Links）

- Axi Todo：暂未创建。方案处于 `draft`；进入 `active` 后按阶段开 Axi Todo 任务。
- 相关文档：
  - `todo/04-roadmap.md` ——「下一轮重点」scope 的源头。
  - `todo/02-legacy-audit.md` —— owner action 表与审计历史的源头。
  - `docs/state/MILESTONE.md` M2 / M4 —— 本方案支撑的源治理与注册覆盖里程碑。
  - `docs/state/PRD.md` REQ-BOUNDARY-001 / REQ-VERIFY-001 —— owner 边界与验证要求。
  - `app/src/mcp/server.ts` —— 主改动文件。
  - `app/vite.config.plugin.ts` —— 副改动文件。
- 验证：
  - `pnpm --dir app test:run`
  - `pnpm --dir app verify`（tsc + vite build）
  - `pnpm --dir app docs:check`
  - 手动 `curl` preflight（CORS 抽查）。
