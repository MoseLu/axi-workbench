# Control Plane API

> 状态：当前基线 · 2026-09-25
>
> `services/control-plane/src/server.mjs` + `services/control-plane/src/control-plane.mjs`（六层控制面模型核心：IMEnvelope 归一化、AgentTask 生命周期、handoff、jobs、risks、governance、policy、events）。
>
> 路由 base path：`/api/v1/control-plane/*`（部分保持 `/snapshot` `/risks/*` `/jobs/*` 等老路径以兼容既有前端）；内部路径全部由 `services/api-gateway/config/routes.yaml` 转发。
>
> 鉴权：所有 endpoint 都依赖 `X-Axi-Subject` + `X-Axi-Tenant`（由 Gateway 从 OIDC session 注入）。所有写操作额外要求 RBAC；**写操作的 RBAC 与动作等级 A/B/C/D 由 policy kernel 校验**（详见 `services/control-plane/src/authorization/policy.mjs`）。

---

## 1. 控制面快照

### `GET /api/v1/control-plane/snapshot`

返回当前租户的受管软件层项目、AgentTask 摘要、审批队列、运行环境和治理态势。是 Web `Dashboard` / `Operations` / `Projects` / `ProjectDetail` / `Team` / `Handoff` 共同消费的快照。

- **鉴权**：session + tenant 匹配
- **请求参数**：无
- **响应**：

```json
{
  "data": {
    "generatedAt": "2026-09-25T00:00:00.000Z",
    "resources": [
      {
        "id": "axi-workbench",
        "resourceId": "axi-workbench",
        "name": "Axi Workbench",
        "label": "Axi Workbench",
        "kind": "product",
        "layer": "software",
        "status": "available",
        "path": "/Volumes/code/workspace/workbench/axi-workbench",
        "provides": ["workstation"],
        "consumes": ["axi-kernel"],
        "contracts": [],
        "commands": [],
        "metadata": { "git": { "branch": "dev", "clean": true, "changedEntries": 0 } }
      }
    ],
    "axiResources": { "project": [ ... ManagedResource[] ... ] },
    "agentTasks": [ ... AgentTask[] ... ],
    "approvals": [ ... ApprovalRequest[] ... ],
    "runtimes": [
      { "kind": "codex_cli", "available": true, "summary": "..." }
    ],
    "governance": { ... GovernanceSnapshot ... }
  }
}
```

- **错误码**：
  - `401`：未登录
  - `403`：跨 tenant 访问
  - `503`：控制面未启动
- **示例**：

```bash
curl -X GET http://127.0.0.1:8088/api/v1/control-plane/snapshot \
  --cookie 'axi.session=<session>' \
  -H 'Accept: application/json'
```

- **Web 调用**：`useControlSnapshot()` (`packages/api-client/src/hooks/index.ts`)

---

## 2. Personal OS

详见 [`personal-os.md`](./personal-os.md)。控制面下 5 个 endpoint 都受同一鉴权保护。

---

## 3. Handoff

详见 [`handoff.md`](./handoff.md)。Web 端 `/admin/handoff` 路由的 6 个 endpoint 都在控制面路由表中。

---

## 4. AgentTask

### `POST /api/v1/agent-tasks`

创建一个受管 AgentTask。`runtime` 决定 codex_cli / codex_app / axi_agent / registered_command / project_diagnosis。

- **鉴权**：session + tenant + RBAC（动作等级 ≥ B）
- **请求参数**（JSON body）：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `runtime` | ✅ | `'codex_cli' \| 'codex_app' \| 'axi_agent' \| 'registered_command' \| 'project_diagnosis'` | 运行时选择 |
| `targetId` | ✅ | `string`（UUID/项目 id） | 受管对象 id |
| `prompt` | ❌ | `string` | 任务提示词（`registered_command` / `project_diagnosis` 不需要） |
| `summary` | ❌ | `string` | UI 显示摘要 |
| `idempotencyKey` | ❌ | `string (UUID v4)` | 缺省时 hook 自动生成 |

- **响应**：

```json
{
  "data": {
    "id": "agent_task_2026-09-25T00-00-00-abc123",
    "status": "queued",
    "runtime": "codex_cli",
    "targetId": "axi-workbench",
    "summary": "...",
    "createdAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **错误码**：
  - `400`：`runtime` 非法 / `targetId` 缺失
  - `403`：动作等级不足 / runtime 不可用
  - `409`：同 `idempotencyKey` 已存在但 payload 不同
  - `503`：所选 runtime 当前不可用（`runtimes[].available=false`）

### `GET /api/v1/agent-tasks/:id`

读取一个 AgentTask 的最新状态。

- **路径参数**：`id` — AgentTask id
- **响应**：

```json
{
  "data": { ... AgentTask ... }
}
```

- **错误码**：`404`（id 不存在 / 跨 tenant）/ `403`
- **Web 调用**：`useAgentTask()` (`packages/api-client/src/hooks/index.ts`)

### `POST /api/v1/agent-tasks/:id/cancel`

取消一个 AgentTask。处于 `succeeded` / `failed` / `cancelled` 终态时返回 `409`。

- **路径参数**：`id`
- **请求 body**：无
- **响应**：`204 No Content`
- **错误码**：`404` / `409`（终态拒绝）/ `403`

### `POST /api/v1/agent-tasks/:id/cancellations`

同 `cancel`，但路径用 `/cancellations` 后缀以兼容 Mobile API。

---

## 5. Approvals

### `POST /api/v1/approvals/:id/decision`

owner 对一条审批做 accept / reject 决定。

- **路径参数**：`id`
- **请求 body**：

```json
{
  "decision": "accept" | "reject",
  "reason": "string（reject 时必填，max 500 字符）"
}
```

- **响应**：

```json
{
  "data": { ... ApprovalRequest ... }
}
```

- **错误码**：
  - `400`：`decision` 非法
  - `403`：当前主体不是 owner
  - `409`：审批已 decision（不可改）
  - `422`：`decision=reject` 但 `reason` 缺失或只含空白

- **Web 调用**：`useDecideApproval()` (`packages/api-client/src/hooks/index.ts`)

### `POST /api/v1/approval-scans/:id/(approve|reject)`

Mobile 扫码后做的二阶段确认。详见 [`mobile.md`](./mobile.md) §审批扫描。

---

## 6. Risks（治理风险）

### `POST /api/v1/risks/:id/accept`

把治理风险从 `open` 标记为 `accepted`（知悉但暂不处理）。

- **路径参数**：`id`
- **响应**：

```json
{
  "data": {
    "id": "risk_xxx",
    "status": "accepted",
    "transitionedAt": "2026-09-25T00:00:00.000Z",
    "transitionedBy": "user_subject"
  }
}
```

### `POST /api/v1/risks/:id/mitigate`

把治理风险标记为 `mitigated`。要求 body 包含 `mitigation` 描述。

- **请求 body**：

```json
{ "mitigation": "string (min 10 chars)" }
```

### `POST /api/v1/risks/:id/block`

把治理风险标记为 `blocked`，强制相关 capability 在治理恢复前拒绝执行。

### `POST /api/v1/risks/:id/escalate`

把治理风险升级给更高权限者（policy-decision-gated）。

### `POST /api/v1/risks/:id/resolve`

最终解决。必须先经过 `accepted` / `mitigated` / `blocked` 之一，否则返回 `422`。

- **通用错误码**：`404` / `403` / `409`（状态机非法）/ `422`
- **Web 调用**：`useTransitionGovernanceRisk()` (`packages/api-client/src/hooks/index.ts`)

---

## 7. Governance Automations

### `POST /api/v1/automations/:id/run`

手动触发一条治理自动化（同步器 / 校核 / remediation 等）。

- **路径参数**：`id`
- **请求 body**（可选）：

```json
{ "force": true }
```

- **响应**：

```json
{
  "data": {
    "automationId": "auto_xxx",
    "runId": "run_yyy",
    "status": "started",
    "startedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **错误码**：
  - `403`：automation 被 policy 禁用
  - `409`：automation 当前 `disabled` 或 cooldown 未到
  - `503`：依赖 runtime 不可用

- **Web 调用**：`useRunGovernanceAutomation()` (`packages/api-client/src/hooks/index.ts`)

---

## 8. Jobs

### `POST /api/v1/jobs`

投递一个异步控制任务；控制面会挑选 registered_command / axi_agent / project_diagnosis 来执行。

- **请求 body**：

```json
{
  "commandId": "string (optional)",
  "agentTaskId": "string (optional)",
  "input": { ... arbitrary JSON ... },
  "idempotencyKey": "string (UUID v4)"
}
```

三者至少给一个；`commandId` 优先于 `agentTaskId`。

- **响应**：`201 Created`

```json
{
  "data": {
    "id": "job_2026-09-25T00-00-00-xyz",
    "status": "received",
    "commandId": "...",
    "agentTaskId": null,
    "createdAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **错误码**：
  - `400`：三者皆空 / `commandId` 未注册
  - `403`：subject 没有触发权限
  - `409`：幂等键已用

### `GET /api/v1/jobs/:id`

读 job 当前状态。

### `GET /api/v1/jobs/:id/events`

读取 job 的事件流（按 `afterEventId` 增量拉取）。

- **查询参数**：`afterEventId?: string`
- **响应**：

```json
{
  "data": [
    { "eventId": "evt_1", "type": "command.started", "occurredAt": "..." },
    { "eventId": "evt_2", "type": "command.finished", "occurredAt": "..." }
  ]
}
```

### `GET /api/v1/jobs/:id/artifacts`

读取 job 产生的 artifacts 列表（路径 + sha256 + 类型）。

### `POST /api/v1/jobs/:id/cancel`

取消运行中的 job。

- **Web 调用**：`useCreateControlJob()` / `useControlJob()` / `useControlJobEvents()` / `useControlJobArtifacts()` / `useCancelControlJob()`

---

## 9. Control Query / Commands

### `POST /api/v1/query`

把自然语言 + 上下文送给 control-plane 的查询引擎（`useControlQuery()`）。

- **请求 body**：

```json
{
  "input": "string（必填）",
  "context": {
    "projectIds": ["..."],
    "runtimeHints": ["codex_cli"]
  }
}
```

- **响应**：

```json
{
  "data": {
    "intent": "list_resources" | "run_health" | "run_verify" | "...",
    "result": { ... Intent-specific response ... }
  }
}
```

- **错误码**：
  - `400`：`input` 为空 / 超长（max 4 KB）
  - `422`：intent 解析失败且无可执行候选
  - `503`：查询引擎依赖 runtime 不可用

### `POST /api/v1/commands/:id/run`

直接以 command id 触发（绕过意图解析）。command id 必须在控制面注册表里。

- **路径参数**：`id`
- **响应**：`202 Accepted`，body 为 `{ data: { runId, status } }`
- **Web 调用**：`useRunControlCommand()` (`packages/api-client/src/hooks/index.ts`)

---

## 10. Workspace Events

### `GET /api/v1/events`

返回租户的 workspace 事件流（agent task 状态变化、handoff 状态变化、policy 决策、风险转换等）。

- **查询参数**：
  - `afterEventId?: string` — 增量游标
  - `limit?: number (default 100, max 500)`
  - `projectId?: string` — 按项目过滤
  - `severity?: 'info' \| 'warning' \| 'error' \| 'critical'`
- **响应**：

```json
{
  "data": [
    {
      "eventId": "evt_...",
      "type": "agent_task.status_changed",
      "occurredAt": "2026-09-25T00:00:00.000Z",
      "projectId": "axi-workbench",
      "subjectRef": "user_subject",
      "severity": "info",
      "details": { "from": "queued", "to": "running" }
    }
  ]
}
```

### `GET /api/v1/events/:id`

读取单条事件详情。

- **Web 调用**：`useWorkspaceEvents()` (`packages/api-client/src/hooks/index.ts`)

---

## 11. Authorization Policy

### `POST /api/v1/authorization/decision`

policy kernel 的裁决端点。Web `Dashboard` / `Operations` 在做风险转换或自动化运行前会先调一次拿裁决结果。

- **请求 body**：

```json
{
  "subjectRef": "user_subject",
  "action": "run_command",
  "scopeRef": "tenant_id",
  "resourceRef": "...",
  "context": { ... }
}
```

- **响应**：

```json
{
  "data": {
    "decision": "allow" | "deny" | "challenge",
    "reason": "string",
    "matchedGrantRefs": ["grant_xxx"],
    "policyVersion": "v2026-09-15"
  }
}
```

### `GET /api/v1/authorization/policy-decisions/:id`

读单条 policy decision 详情（审计用）。

---

## 12. Communication Channel（IMEnvelope 投递）

### `POST /api/v1/communication/messages`

让控制面把外部 IM 信封（IMEnvelope）归一化后分发到目标 channel；正常流路由由 `services/communication-gateway` 接管，本 endpoint 用于 web 端主动发送场景（如 batch 通知）。

- **请求 body**：

```json
{
  "envelope": {
    "id": "...",
    "channel": "feishu" | "mosscoder" | "wechat" | "wecom" | "cc-connect" | "axi-mobile",
    "conversationId": "...",
    "senderId": "...",
    "text": "...",
    "receivedAt": "2026-09-25T00:00:00.000Z",
    "raw": { ... },
    "attachments": []
  }
}
```

- **错误码**：
  - `400`：envelope 字段缺失
  - `422`：channel 未知 / sender 未授权

---

## 13. EPS（API 资产审计）

详见 [`eps.md`](./eps.md)。Web `EpsAudit` 页面消费的 6 个 endpoint 都在控制面路由表中。

---

## 14. Observability Proxy

控制面把 `/api/v1/observability/*` 反代到 observability 上游（`AXI_OBSERVABILITY_URL`）。详见 [`observability.md`](./observability.md)。