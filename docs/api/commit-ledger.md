# Commit Ledger API

> 状态：当前基线 · 2026-09-25
>
> 真实后端：`services/control-plane/src/commit-ledger/api-routes.mjs`。
>
> Base path：`/api/v1/commit-ledger/*`（Gateway 反代到 control-plane 的 `/internal/web/v1/commit-ledger/*`）。
>
> 鉴权：session + tenant。Commit Ledger 是受管工作区的 commit 证据库；**所有 endpoint 都要求主体在该工作区至少拥有 viewer 角色**。
>
> Web 调用：`apps/workbench/src/hooks/useCommitLedger.ts` 9 个 hook + `apps/workbench/src/pages/commit-ledger/CommitLedgerPage.tsx`。

---

## 1. 总览

### `GET /api/v1/commit-ledger/summary`

读工作区 commit ledger 摘要。

- **响应** `200`：

```json
{
  "data": {
    "workspace": {
      "totalProjects": 12,
      "totalCommits": 423,
      "lastCommitAt": "2026-09-25T00:00:00.000Z",
      "verifiedCommits": 380,
      "partialCommits": 21,
      "unverifiedCommits": 18,
      "failedCommits": 4,
      "dirtyWorkspaces": 3,
      "conflictRecords": 1,
      "failedSources": 0
    },
    "byPartition": {
      "projects": { "repos": 5, "commits": 230 },
      "products": { "repos": 2, "commits": 70 },
      "shared": { "repos": 3, "commits": 90 },
      "infra": { "repos": 1, "commits": 23 },
      "tools": { "repos": 1, "commits": 10 }
    },
    "generatedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **Web 调用**：`useCommitLedgerSummary()` (虽然当前没有页面消费，但保留供未来 summary 卡片使用)

---

## 2. Commit 列表

### `GET /api/v1/commit-ledger/commits`

分页查询 commit 记录。

- **查询参数**：
  - `page?: number (default 1)`
  - `limit?: number (default 50, max 100)`
  - `projectId?: string`
  - `partition?: 'projects' | 'products' | 'shared' | 'infra' | 'tools'`
  - `type?: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'perf' | 'test' | 'chore' | 'build' | 'ci' | 'revert'`
  - `verificationStatus?: 'verified' | 'partial' | 'unverified' | 'failed'`
  - `isDirty?: 'true' | 'false'`
  - `sort?: 'committedAt' | 'author' | 'sha'`（default `committedAt`）
  - `order?: 'asc' | 'desc'`（default `desc`）
- **响应** `200`：

```json
{
  "data": [
    {
      "recordId": "rec_xxx",
      "repo": { "projectId": "axi-workbench", "canonicalPath": "...", "partition": "projects" },
      "commit": { "sha": "...", "shortSha": "abc1234", "committedAt": "...", "authoredAt": "...", "type": "feat", "scope": "...", "breaking": false, "subject": "...", "body": "..." },
      "actor": { "name": "...", "email": "..." },
      "verification": { "status": "verified", "commands": ["pnpm test"], "evidenceRefs": ["..."] },
      "workspaceState": { "observedBranch": "dev", "isDirty": false, "ahead": 0, "behind": 0 },
      "diff": { "filesChanged": 5, "insertions": 23, "deletions": 8 },
      "provenance": { "source": "git_cli", "sourcePath": "...", "sourceCommand": "..." },
      "ingestion": { "status": "active", "firstSeenAt": "...", "lastSeenAt": "..." }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 423,
    "hasMore": true
  }
}
```

- **Web 调用**：`useCommitLedgerCommits()` (`apps/workbench/src/hooks/useCommitLedger.ts`)
- **错误码**：`400`（limit > 100）

### `GET /api/v1/commit-ledger/commits/:recordId`

读单条 commit 记录。

- **路径参数**：`recordId`
- **响应** `200`：`{ data: { ...完整记录... } }`
- **错误码**：`404`（recordId 不存在）

> **⚠️ 前端路径 bug 待修**：`apps/workbench/src/hooks/useCommitLedger.ts` 中 `useCommitLedgerRecord` 当前调 `/api/v1/commit-ledger/records/${recordId}`，正确路径是 `/commits/${recordId}`（见 §4 修复说明）。`useCommitLedgerVerification` 同理 — 错误路径 `/records/${recordId}/verification`，正确无此单条路径，需改用 `/verification?recordId=xxx` 模式或新增单条端点。

---

## 3. 验证聚合

### `GET /api/v1/commit-ledger/verification`

读全工作区的验证聚合（按项目分组 + 全局 stats + stale records 列表）。

- **响应** `200`：

```json
{
  "data": {
    "status": { "verified": 380, "partial": 21, "unverified": 18, "failed": 4, "total": 423 },
    "byProject": [
      { "projectId": "axi-workbench", "verified": 100, "partial": 5, "unverified": 0, "failed": 1, "total": 106, "coverage": "0.99" }
    ],
    "staleRecords": [
      { "recordId": "rec_xxx", "staleReason": "evidence_expired", "expiredAt": "..." }
    ]
  }
}
```

---

## 4. 数据源

### `GET /api/v1/commit-ledger/sources`

列出 ingestion 数据源（哪个 git repo / fs watcher / CI 入口）。

- **响应** `200`：

```json
{
  "data": {
    "sources": [
      { "repoId": "axi-workbench", "path": "/Volumes/code/workspace/workbench/axi-workbench", "lastSeenAt": "...", "commitCount": 423, "status": "active", "errors": [] }
    ],
    "failedSources": 0
  }
}
```

- **Web 调用**：`useCommitLedgerSources()`

---

## 5. 项目维度

### `GET /api/v1/commit-ledger/projects`

列出有 commit 记录的项目（含 commitCount + lastCommit）。

- **响应** `200`：

```json
{
  "data": {
    "projects": [
      { "projectId": "axi-workbench", "canonicalPath": "...", "partition": "projects", "commitCount": 423, "lastCommit": "2026-09-25T00:00:00.000Z" }
    ]
  }
}
```

- **Web 调用**：`useCommitLedgerProjects()`

### `GET /api/v1/commit-ledger/projects/:projectId`

读单个项目的 commit 聚合 + 验证覆盖度。

- **路径参数**：`projectId`
- **响应** `200`：

```json
{
  "data": {
    "project": { "id": "...", "canonicalPath": "...", "branch": "dev", "head": "abc1234", "isDirty": false, "commitCount": 423, "lastCommitAt": "...", "partition": "projects" },
    "verification": { "verified": 380, "partial": 21, "unverified": 18, "failed": 4, "total": 423 },
    "evidenceCoverage": "0.95"
  }
}
```

- **错误码**：`404`（projectId 无 commit 记录）

---

## 6. 同步

### `POST /api/v1/commit-ledger/sync`

触发一次全工作区 git ingestion。**异步**，返回 `202` + `jobId`，调用方轮询 `/sync-status/:jobId`。

- **请求 body**（可选）：

```json
{
  "maxCommits": 500,
  "incremental": false,
  "repo": "axi-workbench"
}
```

- **响应** `202`：

```json
{
  "ok": true,
  "accepted": true,
  "jobId": "job_abc123",
  "poll": "/commit-ledger/sync-status/job_abc123",
  "status": "queued"
}
```

- **错误码**：
  - `400`：`maxCommits` 非数字 / 负值
  - `409`：incremental=true 但距上次 sync < 60s（且未指定 `repo`）
  - `503`：git cli 不可用

### `GET /api/v1/commit-ledger/sync-status/:jobId`

读 sync job 状态。

- **响应** `200`：

```json
{
  "data": {
    "jobId": "job_xxx",
    "status": "queued" | "running" | "succeeded" | "failed",
    "startedAt": "...",
    "completedAt": "..." | null,
    "options": { "maxCommits": 500, "incremental": false, "repo": null },
    "progress": { "phase": "linked", "processedCommits": 380, "totalSeen": 423 } | null,
    "result": { "summary": {...}, "synced": {...}, "syncedAt": "..." } | null,
    "error": null | { "message": "..." }
  }
}
```

- **错误码**：`404`（jobId 错位）

---

## 7. 已知问题（待修复）

| 严重度 | 文件 | 问题 | 修复方案 |
|--------|------|------|---------|
| 🟠 中 | `apps/workbench/src/hooks/useCommitLedger.ts` `useCommitLedgerRecord` | 调用 `/records/${id}`，后端是 `/commits/${id}` | 把路径改为 `/commits/${id}` |
| 🟠 中 | 同上 `useCommitLedgerVerification` | 调用 `/records/${id}/verification`，后端没有此路径 | 新增 `/commits/${id}/verification` 单条路由，或在前端改为先调 `/commits/${id}` 后过滤 verification 字段 |

修复后必须在 `apps/workbench/src/hooks/useCommitLedger.ts` 加一条 vitest 覆盖（mock fetch 返回 success），并同步更新本节"已知问题"表（标记 ✅）。