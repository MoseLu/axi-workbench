<!-- Layer: 3 | TODO | Module: workspace-root -->
<!-- Parent Architecture: .claude/ARCHITECTURE.md -->
<!-- Updated: 2026-06-07 -->

# Workspace TODO

This file tracks workspace-level tasks only. Project-local feature work belongs
in the target project. Every P0/P1 task includes a requirement id and a test
case template as required by `.claude/PARADIGM.md`.

## P0

### TD-WRK-DOCS-001 | Align Axi Docs with workspace layered docs | DONE

Priority: P0
Requirement: WRK-DOCS-001 [inferred] Workspace operator docs must be visible
from the documentation hub without making Axi Docs the source of truth.
Files: `projects/axi-docs/app/src/lib/knowledgeBase.ts`, `projects/axi-docs/docs/project-docs.manifest.json`
Estimate: M

Description:
Extend Axi Docs ingestion so root workspace docs, Axi contract docs, and graph
contract pages are discoverable alongside project index pages.

Test Case:

#### TC-WRK-DOCS-001: Workspace operator docs are indexed

Type: integration
Requirement: WRK-DOCS-001

Preconditions:
- `projects/axi-docs/app` dependencies are installed.

Steps:
1. Run `pnpm --dir projects/axi-docs/app verify`.
2. Inspect `projects/axi-docs/app/dist/generated/knowledge/sources/workspace/bundle.json`.

Expected:
- Bundle contains entries for root `AGENTS.md`, `docs/DEV_SERVICES.md`,
  and selected `docs/axi/*.md` files. `docs/governance/*.md` and
  `docs/state/*.md` are tracked via `docs/AGENTS.md` and
  `Makefile` `REQUIRED_DOCS`.
- Existing project index pages remain present.

Acceptance:
- [x] Axi Docs build passes.
- [x] Workspace source includes operator docs and graph contract pages.

### TD-WRK-DOCS-002 | Enforce project docs manifest references | DONE

Priority: P0
Requirement: WRK-DOCS-002 [inferred] Project documentation manifests must not
claim files that do not exist.
Files: `projects/axi-docs/app/scripts/check-docs.mjs`, `projects/axi-docs/docs/project-docs.manifest.json`
Estimate: S

Description:
Add manifest reference validation to Axi Docs governance checks and correct the
current legacy manifest so it represents actual files.

Test Case:

#### TC-WRK-DOCS-002: Manifest paths are validated

Type: integration
Requirement: WRK-DOCS-002

Steps:
1. Run `pnpm --dir projects/axi-docs/app docs:check`.
2. Temporarily point a manifest entry at a missing path in a throwaway copy.

Expected:
- Current manifest passes.
- Missing manifest path fails with a clear error.

Acceptance:
- [x] `docs:check` validates manifest references.
- [x] `project-docs.manifest.json` lists only real files or directories.

## P1

### TD-WRK-INDEX-001 | Generate human-readable graph contract pages | DONE

Priority: P1
Requirement: WRK-INDEX-001 [inferred] Capability nodes in `workspace.graph.json`
need human-readable documentation, not only machine JSON.
Files: `workspace.graph.json`, `docs/axi/*.md`, `projects/axi-docs/app/src/lib/knowledgeBase.ts`
Estimate: M

Description:
Create or generate pages for capability/contract nodes such as `axi-accounts`,
`axi-model-gateway`, `ai-capability`, `minimax-tokenplan`, and `ollama-local`.

Test Case:

#### TC-WRK-INDEX-001: Graph-only capabilities are discoverable

Type: integration
Requirement: WRK-INDEX-001

Expected:
- Axi Docs workspace source has readable entries for capability nodes that are
  not ordinary project directories.
- `workspace-project validate` still passes.

### TD-WRK-SVC-001 | Bind dev service docs to profile checks | DONE

Priority: P1
Requirement: WRK-SVC-001 [inferred] Dev service profiles must have matching
operator docs and doctor checks.
Files: `dev-services.config.json`, `docs/DEV_SERVICES.md`, `scripts/service/devsvc/devsvc`
Estimate: M

Description:
Review all profiles in `dev-services.config.json` against `docs/DEV_SERVICES.md`
and ensure the guide names the correct profile purpose, health path, and
smallest doctor command.

Test Case:

#### TC-WRK-SVC-001: Core service profile is documented and checkable

Type: integration
Requirement: WRK-SVC-001

Steps:
1. Run `/Volumes/code/workspace/scripts/service/devsvc/devsvc doctor core`.
2. Check that `docs/DEV_SERVICES.md` describes every always-on profile.

Expected:
- Doctor output is actionable.
- Docs do not reference removed profiles as active services.

Acceptance:
- [x] `devsvc doctor core` passes with actionable output.
- [x] All config profiles are documented (`manage`, `monitor`, `ingress`, `core`, `daily`, `frontend`, `ielts-vocab`, `fleet-console`, `personal-os-local`, `ai-resource-orchestration`, `resource-search-stack`, `axi-verification-inbox`, `cockpit-tools`, `axi-coder`, `sub2api`, `axi-notify`).

## P2

### LOG-STD-004 | 统一PII脱敏工具 | DONE (2026-09-20)

Priority: P1
Requirement: LOG-STD-004 [inferred] PII redaction must be implemented consistently
across all workspace projects using a single shared implementation.
Files: `foundation/workspace-governance/shared/redact-lib.mjs`,
       `foundation/workspace-governance/scripts/evolution-lib.mjs` (updated),
       `products/ai-resource-orchestration/apps/gateway/src/logging/structured.ts` (updated)
Estimate: S

Description:
合并 `ai-resource-orchestration` 的 `redactSecrets()` 和 `axi-workspace-governance`
的 `redact()` 为统一实现 `foundation/workspace-governance/shared/redact-lib.mjs`，
更新两边的调用方，并标记完成。

Unified implementation:
- Key regex (union): `prompt|output|token|secret|credential|private.?key|authorization|cookie|auth|api[_-]?key|^key$|password`
- String-value patterns (from governance): Bearer tokens, `token=`, `api_key=`, `password=`, `sk-` keys, PEM private keys
- Depth cap = 8 (from resource-orchestration)
- Redacted markers: `[REDACTED]`, `[REDACTED_KEY]`
- Exports: `redact`, `redactSecrets`, `default`

Acceptance:
- [x] `redact-lib.mjs` created in `foundation/workspace-governance/shared/`
- [x] `evolution-lib.mjs` imports and re-exports `redact` from the shared module
- [x] `structured.ts` imports `redactSecrets` from the shared module
- [x] Both call sites compile and pass their existing tests

- Audit root Chinese mirrors against English source docs without copying large
  tables that should remain canonical in English.
- Add lightweight docs inventory generation for root workspace docs.
- Revisit project-local manifests after Axi Docs manifest validation is stable.

<!-- MANUAL: workspace-specific task notes preserved across updates -->

## Outstanding workspace hardening debt (logged 2026-06-10)

These items were surfaced by the 2026-06-10 architecture review and
post-review implementation pass. They are tracked here so the next agent
or operator can pick them up; each item has a one-line fix sketch and a
verification command that is now part of the `make doctor / i18n-verify /
schemas-verify` matrix.

### TD-WRK-HARD-001 | Migrate runtime state to `~/.local/share/axi-workspace/state/`
Status: PARTIAL (2026-09-20)
Priority: P1
Requirement: WRK-FS-001 (state must not live in the repo tree)
Files: `.devsvc/`, `.minimax-outputs/`, `.cc-connect-cache/`, `downloadtemp/`
Estimate: S
Verification: `make doctor-state` should print "no top-level state leaks"
Sketch: Move the four runtime directories under
`/Users/mose/.local/share/axi-workspace/state/`, symlink them back at
their current paths, and update `devsvc-lib.mjs` consumers to follow the
symlinks. The root `.gitignore` already lists the four patterns; once
the data is moved, git diffs of the workspace will go quiet.

Current state:
- `.devsvc/` -> symlinked to `~/.local/share/axi-workspace/state/` ✅
- `.minimax-outputs/` -> NOT symlinked (exists at root, 1 file inside)
- `.cc-connect-cache/` -> NOT symlinked (exists at root, empty)
- `downloadtemp/` -> does not exist at root
- `make doctor-state` target does not exist in any Makefile

Blocked by: Owner decision needed for remaining symlinks. `make doctor-state` verification target missing.

### TD-WRK-HARD-002 | Decide role of `ecosystem.config.cjs`
Status: NEEDS_OWNER_DECISION (2026-09-20)
Priority: P2
Requirement: WRK-CFG-001 (single source of service orchestration truth)
Files: `ecosystem.config.cjs`, `dev-services.config.json`
Estimate: XS
Verification: `make doctor-devsvc` succeeds, README documents the chosen
entry point.
Sketch: Either (a) delete `ecosystem.config.cjs` and point everything at
`dev-services.config.json` + `devsvc start`, or (b) document it as a
"PM2 only" fallback and add a top-of-file comment with the pointer.

Current state:
- `ecosystem.config.cjs` IS actively used by `scripts/service/devsvc/devsvc` as PM2 config entry point
- `devsvc` script at line 87 returns `path.join(config.workspaceRoot, "ecosystem.config.cjs")` for PM2 operations
- `docs/governance/SECRETS.md` documents it as loading `~/credentials/<app>.env`
- `workspace-audit.mjs` tracks both files together
- `make doctor-devsvc` target does not exist

Options:
(a) Delete `ecosystem.config.cjs` and update `devsvc` script to use `pm2 start dev-services.config.json` directly
(b) Keep it as "PM2-only entry point" with clear top-of-file comment pointing to `dev-services.config.json` as source of truth

Blocked by: Owner must choose between option (a) or (b).

### TD-WRK-HARD-003 | Document `foundation/workspace-governance` `drwx------` as intentional
Status: DONE (2026-09-20)
Priority: P2
Requirement: WRK-COLLAB-001 (single-user workstation disclosure)
Files: `README.md`, `foundation/workspace-governance/README.md`
Estimate: XS
Verification: A future co-pilot / second user can read the README and
know the governance repo is private on purpose.
Sketch: Add one sentence at the top of `README.md` calling out that
`/Volumes/code/workspace` is a single-user developer workstation and the
governance directory's permissions are intentional, not a bug.

Implementation: Added permission disclosure note at top of `foundation/workspace-governance/README.md`.

### TD-WRK-HARD-004 | Resolve Chinese-mirror drift detected by `make i18n-verify`
Status: DONE (2026-06-12)
Priority: P2
Requirement: WRK-I18N-001 (EN source, ZH mirror)
Files: `README.md` ↔ `README.zh-CN.md`,
       `WORKSPACE_INDEX.md` ↔ `WORKSPACE_INDEX.zh-CN.md`,
       `foundation/workspace-governance/README.md` ↔ `.../README.zh-CN.md`
Estimate: S
Verification: `make i18n-verify` exits 0.
Sketch: For each failing pair, decide between (a) re-translating the ZH
mirror to match EN token set, or (b) regenerating from EN via
`node scripts/governance/render-i18n.mjs placeholder <en> <zh> --reason "..."`
and then re-translating. The 4747 missing-ZH pairs from
`make i18n-render` (mostly inside subprojects) are tracked separately
in `docs/audit/workspace-i18n-audit-2026-06-07.md`.

### TD-WRK-HARD-005 | Secrets directory + `~/.local/share/axi-workspace/secrets/`
Status: NEEDS_OWNER_DECISION (2026-09-20)
Priority: P2
Requirement: WRK-SEC-001 (physical isolation of credentials)
Files: `agent-cluster/axi-agent/tools/axi-feishu-codex-bridge/`, `tools/axi-proxy-companion/`,
       plus any project that reads tokens today.
Estimate: M
Verification: `find . -name "*.pem" -o -name "*.key" -o -name ".env"` returns
empty inside the repo tree.
Sketch: Move all secret material to
`/Users/mose/.local/share/axi-workspace/secrets/<project>/` and update
project READMEs to point at env vars (e.g. `CODEX_BRIDGE_TOKEN_FILE`).
Add a `secrets/` line to the root `.gitignore` (already present as
defense in depth).

Current state:
- `~/.local/share/axi-workspace/secrets/` does NOT exist
- Current convention per `docs/governance/SECRETS.md`: secrets live in `~/credentials/<app>.env`
- `agent-cluster/axi-agent/tools/axi-feishu-codex-bridge/` and `tools/axi-proxy-companion/` exist but no active secrets detected
- `secrets/` line already exists in root `.gitignore` (defense in depth)

Blocked by: Owner must decide whether to migrate from `~/credentials/` to `~/.local/share/axi-workspace/secrets/` or keep current convention.

### TD-WRK-HARD-006 | Hand-tune `codegraph` watch ignores for `downloadtemp` / `references/archives`
Status: CANNOT_DO (2026-09-20)
Priority: P3
Requirement: WRK-IDX-001 (no index noise)
Files: `.codegraph/config.*` (created on init)
Estimate: XS
Verification: `codegraph status /Volumes/code/workspace --json | jq .pendingChanges`
remains small on idle.
Sketch: `codegraph init` already excludes most build output, but the
`references/archives/` and `downloadtemp/` paths may still surface. Add
explicit ignore globs and re-run `codegraph sync`.

Current state:
- No root-level `.codegraph/config.*` exists
- Codegraph configs exist in project subdirectories only (`workbench/axi-image-preview/.codegraph/config.json`, etc.)
- `downloadtemp/` does not exist at workspace root
- `references/archives/` exists but contains archived project folders (not noise)
- Per-workspace CodeGraph management not applicable; each project manages its own config

### TD-WRK-HARD-007 | Reconcile dev-services health URLs after script move
Status: DONE (2026-09-20)
Priority: P2
Requirement: WRK-SVC-001 (no stale paths in `dev-services.config.json`)
Files: `dev-services.config.json`
Estimate: XS
Verification: `make schemas-verify` passes; `grep -nE "scripts/(run-node22|devsvc)" /Volumes/code/workspace/dev-services.config.json` returns nothing.
Sketch: This was completed on 2026-06-10 for the 11 known services. A
follow-up grep + smoke restart of any service that has not been started
since the move will catch edge cases (e.g. a service whose command
string was concatenated differently).

Verification result: `grep -nE "scripts/(run-node22|devsvc)" dev-services.config.json` returned no matches - no stale script paths detected. All service commands use correct paths.


## 2026-06-13 git-clean 后续待办

- `projects/axi-pet`：在 GitHub 端把 default branch 从 `agent/zero-context-handoff-20260611` 切回 `main`，随后执行 `git push axi --delete agent/zero-context-handoff-20260611` 完成远端清理。
- `archive/axi-sports-management-app`：`feature/frontend-react-migration` 合到 dev 时有 10+ 冲突（Quasar/Vue → Vite/React 18/TypeScript 栈迁移），需用户决定走 A 放弃迁移 / B 解冲突接受 React / C 改长期分支。
- `projects/axi-docs`：`backup/dev-before-origin-realign` 分支不在默认清理范围，确认是否要 `--all-branches` 纳入。
- `foundation/axi-registry`：3 个未跟踪 bak 文件（`htpasswd.bak.20260612-145516`、`pnpm-lock.yaml.v6.bak.20260612-145516`、`storage.bak.20260612-145516/`）可决定是否 `rm`。
- `projects/axi-pet`：`main...origin/main [ahead 28, behind 23]`，合并时用 `--base main` 导致分叉，reconcile 方向待定。

## LOG-STD-008 | 日志存储路径标准化 | DONE (2026-09-20)

Priority: P1
Requirement: LOG-STD-008 [inferred] 日志存储路径统一到 `~/.axi/logs/{service}/` 结构
Files: `workbench/axi-workbench/backend/mini_agent/logger.py`,
       `workbench/axi-workbench/backend/mini_agent/cli.py`,
       `workbench/axi-workbench/backend/local_server/logger.py`,
       `agent-cluster/axi-agent/tools/axi-todo/bin/axi-todo-launchd.mjs`,
       `agent-cluster/axi-agent/infra/codex-remote-bridge/lib/manager-core.mjs`
Estimate: S

Description:
统一日志存储路径到 `~/.axi/logs/{service}/` 结构，替代原来分散的路径：
- `~/.mini-agent/log` (singular) -> `~/.axi/logs/mini-agent/`
- `~/.mini-agent/logs` (plural) -> `~/.axi/logs/local-server/`
- `~/.axi-todo/logs` -> `~/.axi/logs/axi-todo/`
- `~/.antigravity_cockpit/logs` -> `~/.axi/logs/codex-remote-bridge/`

Changes made:
- `logger.py`: `~/.mini-agent/log` -> `~/.axi/logs/mini-agent/`
- `cli.py`: `~/.mini-agent/log` -> `~/.axi/logs/mini-agent/`
- `local_server/logger.py`: `~/.mini-agent/logs` -> `~/.axi/logs/local-server/`
- `axi-todo-launchd.mjs`: `~/.axi-todo/logs` -> `~/.axi/logs/axi-todo/`
- `manager-core.mjs`: `~/.antigravity_cockpit/logs` -> `~/.axi/logs/codex-remote-bridge/`

Directory structure created: `~/.axi/logs/{mini-agent,axi-todo,codex-remote-bridge,local-server}/`

Note: `ielts-vocab` 产品保持项目相对路径 `./logs/` 不变（运行时日志），
`/tmp/` 临时日志保持不变（短期 ephemeral）。

## LOG-STD-005 | Docker日志轮转标准化 | DONE (2026-09-20)

Priority: P1
Requirement: Docker日志轮转统一使用 json-file 驱动和 25MB 轮转配置
Files: `workbench/axi-workbench/docker-compose.backend.yml`,
       `agent-cluster/axi-agent/docker-compose.yml`,
       `foundation/axi-notify/relay-server/docker-compose.yml`,
       `foundation/axi-notify/relay-server/docker-compose.nofb.yml`,
       `projects/axi-pet/apps/server/docker-compose.yml`,
       `foundation/axi-notify/donors/feiyu-agentflow/agentflow-backend/docker-compose.yml`
Estimate: S

Description:
统一 Docker Compose 日志轮转配置为 json-file 驱动、25MB 单文件上限、保留5个轮转文件。

Changes made:
- `workbench/axi-workbench/docker-compose.backend.yml`: `control-plane` 服务 max-size 从 "10m" 改为 "25m"
- `agent-cluster/axi-agent/docker-compose.yml`: 为 `backend` 和 `frontend` 服务添加标准日志配置
- `foundation/axi-notify/relay-server/docker-compose.yml`: 为 `relay` 服务添加标准日志配置
- `foundation/axi-notify/relay-server/docker-compose.nofb.yml`: 为 `relay` 服务添加标准日志配置
- `projects/axi-pet/apps/server/docker-compose.yml`: 为 `api` 服务添加标准日志配置
- `foundation/axi-notify/donors/feiyu-agentflow/agentflow-backend/docker-compose.yml`: 为 `api`, `celery-worker`, `celery-beat` 服务添加标准日志配置

Standard config applied:
```yaml
logging:
  driver: json-file
  options:
    max-size: "25m"
    max-file: "5"
```

Note: 基础设旆服务（postgres, redis, minio等官方镜像）保留原有配置，暂不修改。

## LOG-STD-002 | W3C traceparent 请求ID中间件 | DONE (2026-09-20)

Priority: P1
Requirement: LOG-STD-002 [inferred] 为 axi-workbench resource-gateway 实现 W3C traceparent 请求ID中间件
Files:
- `workbench/axi-workbench/services/resource-gateway/src/logging/traceparent.ts`
- `workbench/axi-workbench/services/resource-gateway/src/server.ts`
Estimate: S

Description:
为 resource-gateway 实现 W3C Trace Context 标准支持，作为统一请求追踪的基础：
- 解析传入的 `traceparent` header（W3C 标准格式：`{version}-{trace-id}-{parent-id}-{trace-flags}`）
- 无 traceparent 时自动生成新的 trace context
- 从 trace-id 派生 requestId 用于可观测性
- 通过响应 header 传播 traceparent 完成分布式追踪

实现细节：
- `traceparent.ts` 提供 `parseTraceparent`、`buildTraceparent`、`extractTraceContext`、`childTraceContext`、`isSampled` 等工具函数
- `server.ts` 的 HTTP handler 使用 `extractRequestTrace` 替代原有的 `newRequestRequestId`
- 响应同时设置 `x-request-id`（派生自 trace-id 前16字符）和 `traceparent` header

Test Case:

#### TC-LOG-STD-002: W3C traceparent 解析和传播

Type: integration
Requirement: LOG-STD-002

Preconditions:
- resource-gateway 服务运行中

Steps:
1. 发送带有效 `traceparent` 的请求：`curl -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" http://localhost:port/health/live`
2. 检查响应 header 包含相同的 `traceparent`

Expected:
- 响应 `traceparent` 与请求一致
- 响应 `x-request-id` 为 trace-id 的前16字符

## LOG-STD-006 | 统一Sentry错误追踪集成 | DONE (2026-09-20)

Priority: P1
Requirement: 统一 Sentry SDK 集成方案，覆盖所有工作区项目框架
Estimate: M

Description:
评估并设计统一 Sentry 错误追踪集成方案。

Findings:
- 当前无任何项目配置 Sentry SDK（`projects/axi-docs/` 无 Sentry 配置，仅在 knowledgeBase.ts 关键词匹配中出现 "sentry"）
- 工作区已有相关 LOG-STD 先前成果：
  - LOG-STD-002: W3C traceparent request ID middleware (`axi-workbench/services/resource-gateway/src/server.ts`)
  - LOG-STD-004: PII 脱敏库 `redact-lib.mjs` (`foundation/workspace-governance/shared/redact-lib.mjs`)
  - LOG-STD-010: 完整堆栈跟踪标准化 (`axi-agent/infra/axi-agent-mcp/src/logger.ts`)
- `observability` skill 含 Sentry 参考文档，但无实际 SDK 实现

Proposed unified template structure:
```
shared/axi-sentry/
  src/
    base.ts          # 通用 init 选项、PII filter、requestId 传播
    browser.ts       # 浏览器端 (@sentry/browser)
    node-server.ts   # Node.js 服务端 (@sentry/node)
    nextjs.ts        # Next.js 封装
  package.json
```

Key design decisions:
- DSN 通过环境变量注入，不硬编码
- PII 脱敏：beforeSend 钩子集成 `redact-lib.mjs`
- requestId 传播：复用 LOG-STD-002 W3C traceparent，Sentry 的 sentry-trace 头自动延续 trace
- production 100% 采样，开发环境默认跳过

各项目接入优先级：
1. `axi-docs` (Vite+React) — 首个试点，低难度
2. `axi-agent` backend (FastAPI/Node) — 低难度
3. `axi-workbench` services (Node.js) — 低难度
4. `axi-pet` server (已有 OpenTelemetry) — 需与 Otel 协调，中难度

Next steps:
1. 创建 `shared/axi-sentry/` 包实现通用 init + beforeSend 脱敏
2. 为 `axi-docs` 首个接入验证模板
3. requestId 传播：sentry.client.config.ts 读取 window.__TRACE_ID__ 建立 browser-to-server trace 关联

## LOG-STD-010 | 增强栈跟踪一致性 | DONE (2026-09-20)

Priority: P2
Requirement: LOG-STD-010 栈跟踪一致性
Files:
- `agent-cluster/axi-agent/infra/axi-agent-mcp/src/logger.ts`
- `agent-cluster/axi-agent/infra/axi-agent-mcp/src/error-handler.ts`
- `foundation/axi-notify/relay-server/internal/relay/event.go`
Estimate: S

Description:
增强 axi-agent TypeScript 和 axi-notify relay 的栈跟踪实现，确保错误时包含完整栈跟踪信息，统一栈跟踪格式。

Enhancements applied:
- `LogEntry` interface: 添加 `stackTrace?: string` 字段
- `TraceSpan` interface: 添加 `stackTrace?: string` 字段
- `Logger.error()`: 捕获完整 stack trace（`error.stack`）
- `Logger.endTrace()`: 支持 Error 对象参数并捕获 stack trace
- `ErrorHandler.getFullError()`: 新增方法返回 {message, stack}
- `EventEnvelope` (Go): 添加 `StackTrace string` 字段
- `BuildFCMData()`: 传播 stackTrace 到 FCM data

Test Case:

#### TC-LOG-STD-010: Stack trace captured and propagated

Type: unit
Requirement: LOG-STD-010

Steps:
1. Create error with stack: `new Error("test")`
2. Call `logger.error("test_event", err)`
3. Call `logger.endTrace(span, "error", err)`
4. Check LogEntry contains both `error` and `stackTrace`
5. Check TraceSpan contains both `error` and `stackTrace`

Expected:
- `error` field contains message only
- `stackTrace` field contains full stack trace string
- Relay envelope includes `stackTrace` in FCM data

Acceptance:
- [x] LogEntry.error stores message only
- [x] LogEntry.stackTrace stores full stack when available
- [x] TraceSpan.stackTrace stores full stack when available
- [x] EventEnvelope.StackTrace propagated to FCM data map

## LOG-STD-009 | DEBUG级别日志补充 | DONE (2026-09-20)

Priority: P1
Requirement: LOG-STD-009 [inferred] 为axi-notify relay等缺失DEBUG日志的项目补充必要DEBUG级别日志
Files:
- `foundation/axi-notify/relay-server/main.go`
- `foundation/axi-notify/relay-server/internal/server/server.go`
Estimate: S

Description:
为axi-notify relay-server补充DEBUG级别日志，通过环境变量`AXI_NOTIFY_LOG_LEVEL`控制（debug/info/warn/error），默认info级别。

Changes made:
- `main.go`: 日志级别通过`AXI_NOTIFY_LOG_LEVEL`环境变量配置，支持debug/info/warn/error四个级别
- `server.go`: 新增DEBUG日志点
  - `handlePostEvents`: 事件接收时记录idempotencyKey/workspaceId/projectId/sessionId/actor/type
  - `handlePostEvents`: 重复事件检测到时记录idempotencyKey
  - `handlePostEvents`: FCM派发时记录tokenCount/type/sessionId
  - `handlePostEvents`: 事件派发成功后记录fcmMessageId/idempotencyKey
  - `handlePutDevice`: 设备注册时记录userId/workspaceId/platform/deviceId/projectCount
  - `handlePutDevice`: 设备注册成功后记录deviceDbId
  - `withAuth`: 认证失败时记录remoteAddr/userAgent
  - `withRateLimit`: 触发限速时记录host

Usage:
```bash
# 启用DEBUG日志
AXI_NOTIFY_LOG_LEVEL=debug ./relay-server

# 默认info级别
./relay-server
```

## LOG-STD 章节索引

> 本章节汇总所有 LOG-STD 任务的成果。完整报告见 [LOG-STD-SUMMARY.md](./LOG-STD-SUMMARY.md)

### 任务总览

| ID | 名称 | 状态 | 产出 |
|----|------|------|------|
| LOG-STD-001 | (未分配) | - | - |
| LOG-STD-002 | W3C traceparent 请求ID中间件 | DONE | `traceparent.ts` |
| LOG-STD-003 | Fix Silent catch blocks | DONE | 16个文件修复 |
| LOG-STD-004 | 统一PII脱敏工具 | DONE | `redact-lib.mjs` |
| LOG-STD-005 | Docker日志轮转标准化 | DONE | 6个 docker-compose.yml |
| LOG-STD-006 | 统一Sentry错误追踪集成 | DONE | 设计文档 (待实现) |
| LOG-STD-007 | Go zerolog时间戳改为RFC3339 | DONE | `main.go` |
| LOG-STD-008 | 日志存储路径标准化 | DONE | 5个项目文件 |
| LOG-STD-009 | DEBUG级别日志补充 | DONE | `relay-server/` |
| LOG-STD-010 | 增强栈跟踪一致性 | DONE | `logger.ts`, `event.go` |

### 统一标准摘要

**时间戳格式**: RFC3339 (ISO 8601)
**日志级别**: DEBUG / INFO / WARN / ERROR (通过环境变量控制)
**请求追踪**: W3C Trace Context (`traceparent` header)
**PII脱敏**: `redact-lib.mjs` 统一实现，深度上限8层
**存储路径**: `~/.axi/logs/{service}/`

### 下一步行动

1. **[P0]** 实现 LOG-STD-006: 创建 `shared/axi-sentry/` 包，为 `axi-docs` 首个接入
2. **[P1]** 归档大型日志文件 (axiom-ui, axiom-workbench, ai-resource-orchestration)
3. **[P1]** 清理 .omx/logs 散落文件，设置30天自动过期
4. **[P2]** 扩展日志存储路径标准化到更多项目
5. **[P2]** 创建 `docs/logs/README.md` 说明保留策略
