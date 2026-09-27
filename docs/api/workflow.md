# Workflow Engine API

> 状态：当前基线 · 2026-09-25
>
> `services/workflow-engine/main.py`（FastAPI，独立 Python 服务）。通过 `services/api-gateway/config/routes.yaml` 反代到 `/api/v1/workflows/*`。
>
> 鉴权：所有 endpoint 接受 Gateway 注入的 `X-Axi-Subject` + `X-Axi-Tenant`；RBAC 通过 policy kernel 在 Gateway 层校验。

---

## 1. 工作流定义 CRUD

### `POST /api/v1/workflows`

新建一个 workflow 定义。

- **请求 body**：

```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "steps": [
    {
      "id": "step_xxx",
      "type": "command" | "agent_task" | "approval" | "delay",
      "config": { ... type-specific ... },
      "dependsOn": ["step_yyy"]
    }
  ],
  "triggers": ["manual" | "schedule" | "event"],
  "tags": ["..."]
}
```

- **响应** `201`：

```json
{
  "data": {
    "id": "wf_2026-09-25T00-00-00-xxx",
    "name": "...",
    "status": "draft",
    "createdBy": "user_sub_xxx",
    "createdAt": "..."
  }
}
```

- **错误码**：
  - `400`：steps 循环依赖 / 缺 id
  - `403`：subject 无 workflow 定义权限

### `GET /api/v1/workflows`

列出当前租户可见的 workflow 定义。

- **查询参数**：
  - `status?: 'draft' | 'published' | 'archived'`
  - `tag?: string`
  - `limit?: number (default 50)`
  - `afterCreatedAt?: string (ISO)`
- **响应**：

```json
{
  "data": [
    { "id": "wf_xxx", "name": "...", "status": "published", "tags": [...] }
  ]
}
```

- **Web 调用**：`useWorkflowEngineWorkflows()`

### `GET /api/v1/workflows/:id`

读取单个 workflow 定义。

- **路径参数**：`id`
- **响应**：

```json
{
  "data": { ... 完整 workflow 定义 ... }
}
```

- **错误码**：`404` / `403`

### `PATCH /api/v1/workflows/:id`

局部更新（name / description / tags / steps / triggers 任一字段）。

- **请求 body**：与 POST 同结构（任一字段可选）
- **响应** `200`
- **错误码**：
  - `400`：steps 循环依赖
  - `409`：status=`published` 时不允许修改 steps（需先 archive → 修改 → publish）
  - `422`：type-specific config 校验失败

### `PUT /api/v1/workflows/:id`

完整替换。除上述 PATCH 错误码外，`404` / `403`。

### `DELETE /api/v1/workflows/:id`

软删除（status → archived）。

- **响应** `204`
- **错误码**：
  - `409`：有 running execution 引用本 workflow（需先 cancel execution）

---

## 2. 执行

### `POST /api/v1/workflows/:id/execute`

启动一次执行。

- **路径参数**：`id`
- **请求 body**：

```json
{
  "input": { ... arbitrary JSON ... },
  "idempotencyKey": "string (UUID v4)"
}
```

- **响应** `202`：

```json
{
  "data": {
    "executionId": "exec_xxx",
    "workflowId": "wf_xxx",
    "status": "queued",
    "startedAt": "..."
  }
}
```

- **错误码**：
  - `403`：workflow archived / 主体无执行权限
  - `409`：同 idempotencyKey 已存在

### `POST /api/v1/workflows/:id/executions`

同 `execute`，但 body 多了 `correlationId` + `context.subject` 字段。

### `GET /api/v1/workflows/:id/execution`

读取当前 workflow 的活动 execution（若有多个，取最新未终态的）。

### `GET /api/v1/workflows/:id/executions/current`

同 `execution` 的语义，但响应是 `{ data: { current: ... } }` 包装。

### `GET /api/v1/workflows/:id/executions`

列出全部历史 executions。

- **查询参数**：`limit`、`afterStartedAt`

---

## 3. 执行事件与产物

### `GET /api/v1/workflows/:workflowId/executions/:executionId/events`

读取 execution 事件流（按时间顺序）。

- **响应**：

```json
{
  "data": [
    { "eventId": "evt_1", "type": "step.started", "stepId": "step_xxx", "occurredAt": "..." },
    { "eventId": "evt_2", "type": "step.finished", "stepId": "step_xxx", "result": "..." }
  ]
}
```

### `GET /api/v1/workflows/:workflowId/executions/:executionId/artifacts`

读取 execution 产物（每 step 可产出 0..N）。

---

## 4. 审批

### `GET /api/v1/workflows/:id/approvals`

列出当前 execution 上挂的待审批事项。

- **响应**：

```json
{
  "data": [
    { "approvalId": "apr_xxx", "stepId": "step_xxx", "status": "pending", "requestedAt": "...", "reviewerRef": "..." }
  ]
}
```

### `POST /api/v1/workflows/:id/approvals/:approvalId`

owner 决定（accept/reject）。

- **请求 body**：

```json
{
  "decision": "accept" | "reject",
  "reason": "string (reject 时必填)"
}
```

- **响应** `200`
- **错误码**：
  - `403`：不是 `reviewerRef`
  - `409`：已 decision
  - `422`：reason 缺失

### `PATCH /api/v1/workflows/:id/approvals/:approvalId`

同 POST，保留为兼容路径。

- **Web 调用**：`useWorkflowEngineApprovals()` / `useDecideWorkflowEngineApproval()`

---

## 5. 取消

### `POST /api/v1/workflows/:id/cancel`

取消当前活动的 execution。

- **响应** `200`
- **错误码**：`409`（已终态）

### `POST /api/v1/workflows/:id/cancellations`

同 `cancel`，兼容路径。

---

## 6. 与 Web 的关系

Web `Workspace.tsx` 用 `useWorkflowEngineWorkflows()` 列出当前租户可见的工作流定义；将来在 Workspace 详情中会扩展到列出 execution 历史和审批队列。Mobile 见 [`mobile.md`](./mobile.md)。