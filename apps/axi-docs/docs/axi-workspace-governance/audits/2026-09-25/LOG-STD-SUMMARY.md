# 日志标准化汇总报告

> 生成时间: 2026-09-20
> 任务范围: LOG-STD-001 ~ LOG-STD-010

---

## 一、任务总览

| ID | 名称 | 状态 | 优先级 | 产出文件 |
|----|------|------|--------|----------|
| LOG-STD-001 | (未分配) | - | - | - |
| LOG-STD-002 | W3C traceparent 请求ID中间件 | DONE | P1 | `workbench/axi-workbench/services/resource-gateway/src/logging/traceparent.ts` |
| LOG-STD-003 | Fix Silent catch blocks | DONE | P1 | `workbench/axi-workbench/` 多文件 |
| LOG-STD-004 | 统一PII脱敏工具 | DONE | P1 | `foundation/workspace-governance/shared/redact-lib.mjs` |
| LOG-STD-005 | Docker日志轮转标准化 | DONE | P1 | 6个 docker-compose.yml |
| LOG-STD-006 | 统一Sentry错误追踪集成 | DONE | P1 | 设计文档 (待实现) |
| LOG-STD-007 | Go zerolog时间戳改为RFC3339 | DONE | P2 | `workbench/axi-workbench/services/api-gateway/cmd/gateway/main.go` |
| LOG-STD-008 | 日志存储路径标准化 | DONE | P1 | 5个项目文件 |
| LOG-STD-009 | DEBUG级别日志补充 | DONE | P1 | `foundation/axi-notify/relay-server/` |
| LOG-STD-010 | 增强栈跟踪一致性 | DONE | P2 | `agent-cluster/axi-agent/infra/axi-agent-mcp/src/logger.ts` |

**完成率**: 9/10 (LOG-STD-001 未分配)

---

## 二、统一日志格式标准

### 2.1 时间戳格式

- **标准**: RFC3339 (ISO 8601)
- **示例**: `2026-09-20T10:30:00Z`
- **实施**:
  - Go (zerolog): `zerolog.TimeFieldFormat = time.RFC3339` (LOG-STD-007)
  - TypeScript: ISO 8601 字符串 via `new Date().toISOString()`
  - Node.js: ISO 8601 via `Date.now()` 或 `process.hrtime()`

### 2.2 日志级别

| 级别 | 用途 | 环境 |
|------|------|------|
| DEBUG | 详细调试信息 | 开发 / 问题诊断 |
| INFO | 正常操作记录 | 所有环境 |
| WARN | 警告信息 | 所有环境 |
| ERROR | 错误信息 | 所有环境 |

**控制方式**:
- Go: 通过日志库配置
- Node.js/TypeScript: 通过 `LOG_LEVEL` 或 `AXI_NOTIFY_LOG_LEVEL` 环境变量
- Docker: 通过 docker-compose `logging` 配置

### 2.3 请求追踪

- **标准**: W3C Trace Context (`traceparent` header)
- **格式**: `{version}-{trace-id}-{parent-id}-{trace-flags}`
- **示例**: `00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01`
- **实施**: LOG-STD-002 在 `axi-workbench/services/resource-gateway/`

**requestId 派生**: 从 trace-id 前16字符派生，通过 `x-request-id` header 传播

### 2.4 PII 脱敏

- **实现**: `foundation/workspace-governance/shared/redact-lib.mjs`
- **脱敏正则**: `prompt|output|token|secret|credential|private.?key|authorization|cookie|auth|api[_-]?key|^key$|password`
- **标记**: `[REDACTED]`, `[REDACTED_KEY]`
- **深度上限**: 8层

---

## 三、统一存储路径标准

### 3.1 路径结构

```
~/.axi/logs/
├── mini-agent/        # axi-workbench mini-agent
├── local-server/      # axi-workbench local-server
├── axi-todo/          # axi-agent tools/axi-todo
└── codex-remote-bridge/ # axi-agent codex-remote-bridge
```

### 3.2 迁移映射

| 原路径 | 新路径 | 项目 |
|--------|--------|------|
| `~/.mini-agent/log` | `~/.axi/logs/mini-agent/` | axi-workbench |
| `~/.mini-agent/logs` | `~/.axi/logs/local-server/` | axi-workbench |
| `~/.axi-todo/logs` | `~/.axi/logs/axi-todo/` | axi-agent |
| `~/.antigravity_cockpit/logs` | `~/.axi/logs/codex-remote-bridge/` | axi-agent |

### 3.3 特殊路径 (保持不变)

- `ielts-vocab`: 项目相对路径 `./logs/` (运行时日志)
- `/tmp/`: 临时日志 (短期 ephemeral)

---

## 四、各任务详情

### LOG-STD-002 | W3C traceparent 请求ID中间件

**目标**: 为 resource-gateway 实现 W3C Trace Context 标准支持

**实现**:
- `traceparent.ts`: 提供 `parseTraceparent`, `buildTraceparent`, `extractTraceContext`, `childTraceContext`, `isSampled` 等工具函数
- `server.ts`: 使用 `extractRequestTrace` 替代原有 `newRequestRequestId`

**文件变更**:
- `workbench/axi-workbench/services/resource-gateway/src/logging/traceparent.ts` (新建)
- `workbench/axi-workbench/services/resource-gateway/src/server.ts` (更新)

**验证**: 传入有效 `traceparent` header 时，响应 header 包含相同的 `traceparent` 和派生的 `x-request-id`

---

### LOG-STD-003 | Fix Silent catch blocks

**目标**: 修复所有静默 catch 块，确保错误被正确记录

**修复文件** (16处):
- `backend/local_server/__init__.py`
- `apps/axi-docs/app/project_manager.py`
- `apps/app-search-system/backend/build_embedding.py`
- `apps/app-search-system/backend/build_parallel.py`
- `apps/app-search-system/backend/scripts/run_pipeline.py`
- `apps/app-search-system/backend/api_sop.py`
- `apps/app-search-system/backend/scripts/build_chroma.py`
- `backend/mini_agent/skills/slack-gif-creator/core/typography.py`
- `backend/mini_agent/skills/slack-gif-creator/core/validators.py`
- `backend/mini_agent/skills/slack-gif-creator/core/frame_composer.py`

---

### LOG-STD-004 | 统一PII脱敏工具

**目标**: 合并分散的 PII 脱敏实现为统一库

**实现**: `foundation/workspace-governance/shared/redact-lib.mjs`

**统一配置**:
- Key regex: `prompt|output|token|secret|credential|private.?key|authorization|cookie|auth|api[_-]?key|^key$|password`
- String-value patterns: Bearer tokens, `token=`, `api_key=`, `password=`, `sk-` keys, PEM private keys
- 深度上限: 8
- 标记: `[REDACTED]`, `[REDACTED_KEY]`

**文件变更**:
- `foundation/workspace-governance/shared/redact-lib.mjs` (新建)
- `foundation/workspace-governance/scripts/evolution-lib.mjs` (更新 - 导入共享模块)
- `products/ai-resource-orchestration/apps/gateway/src/logging/structured.ts` (更新 - 导入共享模块)

---

### LOG-STD-005 | Docker日志轮转标准化

**目标**: 统一 Docker Compose 日志轮转配置

**标准配置**:
```yaml
logging:
  driver: json-file
  options:
    max-size: "25m"
    max-file: "5"
```

**文件变更**:
- `workbench/axi-workbench/docker-compose.backend.yml` (更新 `control-plane` 服务 max-size: 10m → 25m)
- `agent-cluster/axi-agent/docker-compose.yml` (添加 `backend`, `frontend` 服务配置)
- `foundation/axi-notify/relay-server/docker-compose.yml` (添加 `relay` 服务配置)
- `foundation/axi-notify/relay-server/docker-compose.nofb.yml` (添加 `relay` 服务配置)
- `projects/axi-pet/apps/server/docker-compose.yml` (添加 `api` 服务配置)
- `foundation/axi-notify/donors/feiyu-agentflow/agentflow-backend/docker-compose.yml` (添加 `api`, `celery-worker`, `celery-beat` 服务配置)

**注**: 基础设施服务 (postgres, redis, minio 等) 保留原有配置

---

### LOG-STD-006 | 统一Sentry错误追踪集成

**目标**: 评估并设计统一 Sentry SDK 集成方案

**当前状态**: 无项目配置 Sentry SDK

**设计草案**:
```
shared/axi-sentry/
├── src/
│   ├── base.ts          # 通用 init 选项、PII filter、requestId 传播
│   ├── browser.ts       # 浏览器端
│   ├── node-server.ts   # Node.js 服务端
│   └── nextjs.ts        # Next.js 封装
└── package.json
```

**Key 设计决策**:
- DSN 通过环境变量注入
- beforeSend 钩子集成 `redact-lib.mjs`
- 复用 LOG-STD-002 W3C traceparent
- production 100% 采样，开发环境默认跳过

**建议优先级**:
1. `axi-docs` (Vite+React) — 首个试点
2. `axi-agent` backend — FastAPI/Node
3. `axi-workbench` services — Node.js
4. `axi-pet` server — 需与 OpenTelemetry 协调

---

### LOG-STD-007 | Go zerolog时间戳改为RFC3339

**目标**: 统一 Go 服务日志时间戳格式

**变更**: `zerolog.TimeFieldFormat` 从 `zerolog.TimeFormatUnix` 改为 `time.RFC3339`

**文件**: `workbench/axi-workbench/services/api-gateway/cmd/gateway/main.go:160`

---

### LOG-STD-008 | 日志存储路径标准化

**目标**: 统一日志存储到 `~/.axi/logs/{service}/` 结构

**变更文件**:
- `workbench/axi-workbench/backend/mini_agent/logger.py`: `~/.mini-agent/log` → `~/.axi/logs/mini-agent/`
- `workbench/axi-workbench/backend/mini_agent/cli.py`: `~/.mini-agent/log` → `~/.axi/logs/mini-agent/`
- `workbench/axi-workbench/backend/local_server/logger.py`: `~/.mini-agent/logs` → `~/.axi/logs/local-server/`
- `agent-cluster/axi-agent/tools/axi-todo/bin/axi-todo-launchd.mjs`: `~/.axi-todo/logs` → `~/.axi/logs/axi-todo/`
- `agent-cluster/axi-agent/infra/codex-remote-bridge/lib/manager-core.mjs`: `~/.antigravity_cockpit/logs` → `~/.axi/logs/codex-remote-bridge/`

**创建的目录**:
```
~/.axi/logs/{mini-agent,axi-todo,codex-remote-bridge,local-server}/
```

---

### LOG-STD-009 | DEBUG级别日志补充

**目标**: 为缺失 DEBUG 日志的项目补充必要日志

**实现**: `AXI_NOTIFY_LOG_LEVEL` 环境变量控制 (debug/info/warn/error)，默认 info

**新增 DEBUG 日志点** (`axi-notify/relay-server/`):
- `main.go`: 日志级别配置
- `server.go`:
  - `handlePostEvents`: 事件接收 (idempotencyKey/workspaceId/projectId/sessionId/actor/type)
  - `handlePostEvents`: 重复事件检测
  - `handlePostEvents`: FCM 派发 (tokenCount/type/sessionId)
  - `handlePostEvents`: 事件派发成功 (fcmMessageId/idempotencyKey)
  - `handlePutDevice`: 设备注册 (userId/workspaceId/platform/deviceId/projectCount)
  - `handlePutDevice`: 设备注册成功 (deviceDbId)
  - `withAuth`: 认证失败 (remoteAddr/userAgent)
  - `withRateLimit`: 触发限速 (host)

---

### LOG-STD-010 | 增强栈跟踪一致性

**目标**: 确保错误时包含完整栈跟踪信息

**实现**:
- `LogEntry` interface: 添加 `stackTrace?: string` 字段
- `TraceSpan` interface: 添加 `stackTrace?: string` 字段
- `Logger.error()`: 捕获完整 stack trace (`error.stack`)
- `Logger.endTrace()`: 支持 Error 对象参数并捕获 stack trace
- `ErrorHandler.getFullError()`: 新增方法返回 `{message, stack}`
- `EventEnvelope` (Go): 添加 `StackTrace string` 字段
- `BuildFCMData()`: 传播 stackTrace 到 FCM data

**文件变更**:
- `agent-cluster/axi-agent/infra/axi-agent-mcp/src/logger.ts`
- `agent-cluster/axi-agent/infra/axi-agent-mcp/src/error-handler.ts`
- `foundation/axi-notify/relay-server/internal/relay/event.go`

---

## 五、验证结果

### 5.1 已验证项目

| 任务 | 验证方式 | 状态 |
|------|----------|------|
| LOG-STD-002 | traceparent header 传播测试 | PASS |
| LOG-STD-003 | 代码审查 + 静态分析 | PASS |
| LOG-STD-004 | 导入测试 + 编译验证 | PASS |
| LOG-STD-005 | docker-compose config 验证 | PASS |
| LOG-STD-007 | zerolog 输出格式检查 | PASS |
| LOG-STD-008 | 目录结构验证 | PASS |
| LOG-STD-009 | DEBUG 日志运行时验证 | PASS |
| LOG-STD-010 | 单元测试验证 | PASS |

### 5.2 待验证项目

| 任务 | 验证方式 | 状态 |
|------|----------|------|
| LOG-STD-006 | 需要实际接入 Sentry SDK | PENDING |

---

## 六、下一步行动建议

### P0 (立即处理)

1. **实现 LOG-STD-006 (Sentry 集成)**
   - 创建 `shared/axi-sentry/` 包
   - 为 `axi-docs` 首个接入验证模板
   - 复用 LOG-STD-002 traceparent 进行 requestId 传播

### P1 (近期处理)

2. **归档大型日志文件**
   - 根据 `LOGS_SYSTEM_REPORT.md` 归档 axiom-ui 2026-06 前 submit 记录
   - 归档 axiom-workbench 2026-05 前 submit 记录
   - 归档 ai-resource-orchestration 2026-06 前 submit 记录

3. **清理 .omx/logs 散落文件**
   - 设置 30 天自动过期策略
   - 删除 2026-08-17 前的文件

### P2 (规划中)

4. **统一日志存储扩展**
   - 将更多项目日志路径迁移到 `~/.axi/logs/{service}/`
   - 制定项目级日志保留策略

5. **创建日志 README**
   - 在 `docs/logs/` 创建 README.md
   - 说明各子目录用途和保留策略

### P3 (长期优化)

6. **合并 axiom-soul-world 多 lane**
   - 合并到主分支后清理冗余 submit 记录

7. **自动化日志归档**
   - 实现按月自动归档脚本
   - 集成到 CI/CD 流程

---

## 七、相关文档

- `/Volumes/code/workspace/docs/state/LOGS_SYSTEM_REPORT.md` - 日志体系现状报告
- `/Volumes/code/workspace/docs/state/TODO.md` - 工作区 TODO 列表
- `/Volumes/code/workspace/workbench/axi-workbench/docs/state/TODO.md` - Axi Workbench TODO 列表
- `/Volumes/code/workspace/foundation/workspace-governance/shared/redact-lib.mjs` - PII 脱敏库
- `/Volumes/code/workspace/workbench/axi-workbench/services/resource-gateway/src/logging/traceparent.ts` - W3C traceparent 实现

---

*本报告由 Claude Code 自动生成，内容基于 2026-09-20 的工作区状态*
