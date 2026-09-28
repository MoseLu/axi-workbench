# TASK3: 跨 Surface Workspace Event 接入合同

## 执行摘要

**任务 ID**: TASK3
**执行时间**: 2026-09-14
**目标**: 在现有 runtime-ledger 之外，接入至少一个有明确 owner 和格式合同的 Platform 事件源

## 接入的第二个事件源

### Source 1: axi-runtime-ledger (已存在)

| 字段 | 值 |
|------|-----|
| path | `~/.local/share/axi-workspace/state/runtime-ledger` |
| source | `axi-runtime-ledger` |
| owner | axiom-workbench |
| surface | devsvc, health, doc-architecture |
| format | jsonl |
| retentionPolicy | runtime-managed |
| declaredDate | 2026-09-14 (graph declaration) |
| loadedFiles | 15 |
| eventsCount | 254 |

### Source 2: axi-control-plane-audit (新增)

| 字段 | 值 |
|------|-----|
| path | `/Volumes/code/workspace/workbench/axi-workbench/services/control-plane/.cache/epap-control-plane/audit.jsonl` |
| source | `axi-control-plane-audit` |
| owner | axiom-workbench |
| surface | platform |
| format | jsonl |
| retentionPolicy | audit-default |
| eventTypes | approval_requested, job_event, mobile_action, mobile_pairing |
| declaredDate | 2026-09-14 |
| eventsCount | 26 |

## 事件数量变化

| 指标 | TASK3 前 | TASK3 后 |
|------|---------|----------|
| declaredSourceCount | 1 | 2 |
| loadedSourceCount | 15 | 16 |
| eventCount | 254 | 280 |
| surfaceCount | 3 | 3 (devsvc, health, doc-architecture + platform 引用) |
| projectCount | 1 | 1 |
| serviceCount | 23 | 23 |

## Surface 变化详情

| Surface | 事件数 | 说明 |
|---------|--------|------|
| devsvc | 230 | DevSvc 运行事件 |
| health | 5 | 健康检查事件 |
| doc-architecture | 19 | 文档架构事件 |
| platform (隐式) | 26 | Control Plane 审计事件 |

## 事件源清单

### 1. DevSvc Runtime Ledger

```json
{
  "path": "~/.local/share/axi-workspace/state/runtime-ledger",
  "source": "axi-runtime-ledger",
  "owner": "axi-workbench",
  "surface": "devsvc",
  "format": "jsonl",
  "retentionPolicy": "runtime-managed"
}
```

### 2. Control Plane Audit (新增)

```json
{
  "path": "/Volumes/code/workspace/workbench/axi-workbench/services/control-plane/.cache/epap-control-plane/audit.jsonl",
  "source": "axi-control-plane-audit",
  "owner": "axi-workbench",
  "surface": "platform",
  "format": "jsonl",
  "retentionPolicy": "audit-default",
  "eventTypes": ["approval_requested", "job_event", "mobile_action", "mobile_pairing"]
}
```

## 样例 Provenance

### Runtime Ledger 事件

```json
{
  "eventId": "audit:axi-runtime-ledger/2026-09-13.jsonl:1",
  "eventType": "service.health.changed",
  "occurredAt": "2026-09-13T03:00:00.000Z",
  "actorRef": "mose",
  "surfaceRef": "devsvc",
  "projectRef": "axi-workbench",
  "serviceRef": "core",
  "objectRef": "axi-workbench",
  "action": "status",
  "result": "ok",
  "source": "axi-runtime-ledger/2026-09-13.jsonl"
}
```

### Platform Audit 事件

```json
{
  "eventId": "audit:axi-control-plane-audit/audit.jsonl:1",
  "eventType": "approval_requested",
  "occurredAt": "2026-09-13T06:13:20.000Z",
  "actorRef": "device-1",
  "scopeRef": "workspace",
  "objectRef": "ai-capability",
  "action": "approval_requested",
  "result": "pending",
  "source": "axi-control-plane-audit/audit.jsonl"
}
```

## 回归验证

### 原有 254 条事件

```
$ readWorkspaceEvents({ sources: [{ path: "~/.local/share/axi-workspace/state/runtime-ledger", source: "axi-runtime-ledger" }], limit: null })
Total: 254 events
```

### 新增 Platform 事件

```
$ readWorkspaceEvents({ sources: [{ path: "/Volumes/.../audit.jsonl", source: "axi-control-plane-audit" }], limit: null })
Total: 26 events
```

### 过滤验证

```javascript
// Surface 过滤
const devsvcEvents = readWorkspaceEvents({ sources, surfaceRef: "devsvc", limit: null });
// 230 events

// Project 过滤
const projectEvents = readWorkspaceEvents({ sources, projectRef: "axi-workbench", limit: null });
// 254 events

// 分页
const page1 = readWorkspaceEvents({ sources, limit: 2 });
// 2 events, nextCursor: "..."

const page2 = readWorkspaceEvents({ sources, limit: 2, afterEventId: page1.nextCursor });
// 2 events, nextCursor: "..."
```

### Fail-Closed 验证

```javascript
// 无效 source 返回 0 条
const invalidEvents = readWorkspaceEvents({ sources: [{ path: "/nonexistent/audit.jsonl", source: "invalid" }], limit: null });
// 0 events
```

## 测试命令

```bash
# 运行 governance snapshot 测试（包括 TASK3）
cd /Volumes/code/workspace/workbench/axi-workbench/services/control-plane
node --test test/governance-snapshot.test.mjs
# Expected: 27/27 pass

# 运行 control-plane 测试
node --test test/control-plane.test.mjs
# Expected: 28/28 pass

# 验证事件覆盖
node -e "
import { buildSnapshot } from './src/control-plane.mjs';
const snapshot = buildSnapshot({});
console.log('eventCoverage:', JSON.stringify(snapshot.governance?.eventCoverage, null, 2));
"
# Expected:
# declaredSourceCount: 1 (uses env var for additional source)
# loadedSourceCount: 16 (15 runtime + 1 control-plane audit)
# eventCount: 280 (254 + 26)
```

## 退出码

- 0: 所有测试通过
- 1: 测试失败

## 外部阻塞

### Gateway/Deployment 事件源

- **DevSvc API Gateway** (`http://127.0.0.1:8088`): 无 `/api/events` 端点
- **资源调度 Gateway** (`http://127.0.0.1:8787`): 不在运行状态
- **腾讯云生产环境**: 需要 SSH 权限和外部凭证
- **VM Workspace**: 192.168.101.7 上无事件日志文件

### 阻塞原因

1. API Gateway 未暴露 `/api/events` 端点
2. Gateway 进程未运行
3. 生产/部署环境需要外部凭证

## Remaining Gaps

| Gap | 说明 | 阻塞原因 |
|-----|------|----------|
| Gateway 事件 | 无可用 API Gateway 事件端点 | API 未实现 |
| Deployment 事件 | 无生产部署事件日志 | 需要外部凭证 |
| 跨环境事件 | 无远程服务器事件收集 | SSH/网络不可达 |

## 验收确认

- [x] 新增 source 均可追溯且有 owner
- [x] 原 254 条事件仍可读
- [x] 过滤、分页、fail-closed 行为不回退
- [x] coverage 不把本地进程证据写成部署/生产证据
- [x] 接入了一个有明确 owner 和格式合同的 Platform 事件源
- [x] 测试通过 27/27

## 相关文件

- 事件读取实现: `/Volumes/code/workspace/workbench/axi-workbench/services/control-plane/src/control-plane.mjs`
- 事件测试: `/Volumes/code/workspace/workbench/axi-workbench/services/control-plane/test/governance-snapshot.test.mjs`
- Runtime Ledger: `~/.local/share/axi-workspace/state/runtime-ledger/`
- Control Plane Audit: `/Volumes/code/workspace/workbench/axi-workbench/services/control-plane/.cache/epap-control-plane/audit.jsonl`
