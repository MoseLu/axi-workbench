# File Service API

> 状态：当前基线 · 2026-09-25
>
> `services/file-service/main.py`（FastAPI）+ S3/MinIO + PostgreSQL 元数据。
>
> Base path：`/api/v1/files/*`（Gateway 反代到 file-service）。
>
> 鉴权：所有 endpoint 接受 Gateway 注入的 `X-Axi-Internal-Token` + `X-Axi-Subject`。

---

## 1. 上传

### `POST /api/v1/files/upload`

单文件上传（multipart/form-data）。

- **请求**：`multipart/form-data`
  - `file`: 二进制（必填，max 100 MB）
  - `purpose?: string`（用途：avatar / attachment / artifact / log_dump）
  - `tenantId?: string`（缺省取当前主体所属 tenant）
  - `visibility?: 'private' | 'tenant' | 'public'`（缺省 `'tenant'`）
- **响应** `201`：

```json
{
  "data": {
    "fileId": "file_xxx",
    "filename": "...",
    "size": 12345,
    "contentType": "...",
    "purpose": "...",
    "uploadedBy": "user_sub_xxx",
    "uploadedAt": "...",
    "etag": "..."
  }
}
```

- **错误码**：
  - `400`：content-type 黑名单（`.exe` 等）
  - `413`：超过 max size
  - `429`：单租户上传频率超限
  - `503`：S3/MinIO 不可达

### `POST /api/v1/files/upload/multipart`

分片上传（每个分片 ≤ 10 MB）。用于大文件。

- **请求**：multipart/form-data
  - `file`: 分片二进制
  - `uploadId`: string（由 `POST /files/uploads` 预签发）
  - `partNumber`: int
  - `totalParts`: int
- **响应** `200`：

```json
{ "data": { "etag": "...", "uploadId": "...", "partNumber": 5 } }
```

### `POST /api/v1/files/uploads`

预签发分片上传会话，返回 `uploadId`。

- **请求 body**：

```json
{ "filename": "...", "size": 12345678, "contentType": "...", "purpose": "..." }
```

- **响应** `201`：

```json
{ "data": { "uploadId": "upl_xxx", "partSize": 10485760, "expiresAt": "..." } }
```

---

## 2. 下载 / 缩略图

### `GET /api/v1/files/:filename`

下载原文件。

- **路径参数**：`filename`（已 URL 编码）
- **查询参数**：`inline?: boolean`（缺省 false，触发 Content-Disposition: attachment）
- **响应** `200`：二进制流 + 正确 Content-Type
- **错误码**：`404`（不存在 / 跨 tenant）/ `403`（无读取权限）

### `GET /api/v1/files/:filename/download`

等价于 `GET /:filename` 但**始终**触发下载（不会被 inline）。

### `GET /api/v1/files/:filename/thumbnail`

读取缩略图（仅 image/* 支持）。

- **查询参数**：`w?: number (max 1024)`、`h?: number`、`fit?: 'cover' | 'contain'`
- **响应** `200`：image binary
- **错误码**：`404`（非图片）/ `415`（format 错）

### `GET /api/v1/files/:filename/presigned`

读临时预签名 URL（短时 5 分钟有效）。

- **响应** `200`：

```json
{
  "data": {
    "url": "https://s3..../...?X-Amz-Expires=300",
    "expiresAt": "..."
  }
}
```

- **用途**：第三方 fetch / 公开分享

---

## 3. 删除

### `DELETE /api/v1/files/:filename`

删除文件（仅上传者 / tenant admin 可删）。

- **响应** `204`
- **错误码**：
  - `403`：无删除权限
  - `409`：文件被引用（avatar / handoff attachment）

---

## 4. 元数据

### `GET /api/v1/files/:filename/metadata`

读取文件元数据（不下载 body）。

- **响应** `200`：与上传响应同（去掉 `etag`）

### `PATCH /api/v1/files/:filename/metadata`

更新 `purpose` / `visibility` / 标签。

- **请求 body**：

```json
{
  "purpose"?: "avatar" | "attachment" | "artifact" | "log_dump",
  "visibility"?: "private" | "tenant" | "public",
  "tags"?: { "key": "value" }
}
```

- **响应** `200`
- **错误码**：`403`（非 owner）/ `404`

---

## 5. Web 接入

- `apps/workbench/src/hooks/useFileUpload.ts`（在 `pages/admin/me/`）封装 `POST /files/upload`。
- `apps/workbench/src/pages/admin/me/Devices.tsx` / `AccountInfo.tsx` 用上传端点更新头像。
- 暂未暴露独立 `/admin/files` 页面（PRD §6 C-20 范围，留待后续工作流/审计能力上线后接入）。