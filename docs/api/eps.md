# EPS (API 资产审计) API

> 状态：当前基线 · 2026-09-25
>
> `services/control-plane/src/server.mjs` §"/eps/*" 路由组（EPS = Engineered Performance Summary）。
>
> Base path：`/api/v1/control-plane/eps/*`（注意：实际挂在 control-plane 的 `/eps/*` 上，公开路径为 `/api/v1/control-plane/eps/*`，由 Gateway 反代 `/api/v1/control-plane/*` 通配转发）。
>
> 鉴权：session + tenant + admin。
>
> Web 调用：`apps/workbench/src/pages/admin/EpsAudit.tsx` — `useEpsAssets()` + `useRunEpsAudit()`。

---

## 1. 资产清单

### `GET /eps/assets`

列出当前工作区所有 API 资产（按 platform / method / path 聚合）。

- **查询参数**：
  - `platform?: 'platform-core' | 'control-plane' | 'identity-adapter' | 'notification-service' | 'workflow-engine' | 'file-service' | '...'`
  - `service?: string`
  - `limit?: number (default 100, max 500)`
- **响应** `200`：

```json
{
  "data": {
    "items": [
      {
        "id": "asset_xxx",
        "platform": "platform-core",
        "service": "platform-core",
        "method": "GET",
        "path": "/api/v1/tenants",
        "source": "go-runtime-reflection"
      }
    ]
  }
}
```

- **Web 调用**：`useEpsAssets()`
- **错误码**：
  - `404`：EPS 模块未挂载（前端必须显式提示"模块未启用"）
  - `503`：EPS worker 未启动

---

## 2. 单条资产

### `GET /eps/assets/:id`

读单个资产的元数据 + 历史审计结果。

- **路径参数**：`id`
- **响应** `200`：`{ data: { ... asset ... audit history ... } }`
- **错误码**：`404` / `403`

---

## 3. 发现审计

### `POST /eps/audits`

触发一次 EPS 发现审计（扫描当前服务的所有 routes，注册新资产、对比历史、产出 finding）。

- **请求 body**（可选）：

```json
{
  "scopes": ["platform-core", "control-plane"],
  "incremental": true
}
```

- **响应** `202`：

```json
{
  "data": {
    "auditId": "audit_xxx",
    "status": "started",
    "scopes": ["platform-core", "control-plane"],
    "startedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **错误码**：
  - `403`：非 admin
  - `409`：同 idempotencyKey 已存在
  - `503`：依赖的 reflection runtime 不可用

- **Web 调用**：`useRunEpsAudit()` — 启动后立即 fire-and-forget，结果通过 `findings` 与 `runs` 拉取

---

## 4. Findings（发现的问题）

### `GET /eps/findings`

列出所有 EPS 发现的问题（每条 finding 对应一个资产 + 一类问题）。

- **查询参数**：
  - `severity?: 'info' | 'warning' | 'error' | 'critical'`
  - `category?: 'missing_doc' | 'missing_test' | 'auth_gap' | 'contract_drift' | 'rate_limit_missing' | 'deprecated'`
  - `assetId?: string`
  - `acknowledged?: boolean`
  - `limit?: number (default 50)`
- **响应** `200`：

```json
{
  "data": {
    "items": [
      {
        "id": "fnd_xxx",
        "assetId": "asset_xxx",
        "category": "missing_doc",
        "severity": "warning",
        "summary": "该 endpoint 在 OpenAPI 文档中缺失",
        "details": { "expected": "...", "actual": null },
        "acknowledgedBy": "user_sub_xxx" | null,
        "acknowledgedAt": "..." | null,
        "discoveredAt": "2026-09-25T00:00:00.000Z"
      }
    ]
  }
}
```

### `GET /eps/findings/:id`

读单条 finding 详情。

- **路径参数**：`id`
- **响应** `200`
- **错误码**：`404`

### `POST /eps/findings/:id/acknowledge`

标记 finding 为已知。

- **路径参数**：`id`
- **请求 body**：

```json
{ "reason": "string (min 5, max 500)" }
```

- **响应** `200`
- **错误码**：`403` / `409`（已 ack）

---

## 5. Runs（审计执行历史）

### `GET /eps/runs`

列出所有审计执行历史。

- **查询参数**：
  - `scopes?: string[]`
  - `limit?: number (default 20)`
- **响应** `200`：

```json
{
  "data": {
    "items": [
      {
        "id": "run_xxx",
        "status": "running" | "succeeded" | "failed" | "cancelled",
        "scopes": ["platform-core"],
        "startedAt": "...",
        "completedAt": "..." | null,
        "summary": { "assetsScanned": 42, "newAssets": 3, "driftDetected": 1, "findings": 7 }
      }
    ]
  }
}
```

### `GET /eps/runs/:id`

读单条 run 详情。

- **路径参数**：`id`
- **响应** `200`：`{ data: { ... full run ... } }`
- **错误码**：`404`

### `POST /eps/runs/:id/cancel`

取消进行中的 run。

- **响应** `204`
- **错误码**：`409`（已终态）

---

## 6. 项目运行时

### `GET /eps/projects/:projectId`

读项目维度的 EPS 聚合。

- **响应** `200`：`{ data: { projectId, assetCount, findingCount, lastRunId, ... } }`

### `GET /eps/runtime`

读 EPS 自身运行时状态。

- **响应** `200`：

```json
{
  "data": {
    "status": "healthy",
    "lastSuccessfulRunAt": "...",
    "scannedScopes": ["platform-core", "control-plane", "identity-adapter"],
    "generatedAt": "..."
  }
}
```

- **错误码**：`503`（EPS worker 不健康）

---

## 7. 与 Workbench 的关系

- Web `EpsAudit.tsx` 当前只暴露"运行审计"按钮 + 资产清单表格；findings / runs / 项目维度留作后续 PRD §6 C-17/C-20 工作流/审计能力的入口。
- 同步规则：本目录与 [`commit-ledger.md`](./commit-ledger.md) 类似，每次 `/eps/*` 路由新增或修改必须同步。