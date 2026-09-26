---
name: axi-docs-mcp
description: Axi Docs MCP 服务器的架构规则和开发指南
---

# Axi Docs MCP Server AGENTS.md

> 本文件定义 Axi Docs MCP (Model Context Protocol) 服务器的架构规则。所有 MCP 相关代码变更必须符合本文件的设计原则。

---

## MCP 服务器概述

Axi Docs MCP 服务器实现 MCP 协议，为 Claude Code 和其他 AI 工具提供文档访问能力。

---

## 核心功能

### 1. 文档访问工具

提供对 Obsidian 知识库的访问：
- `obsidian_scan` - 扫描目录
- `obsidian_read` - 读取文件
- `obsidian_write` - 写入文件
- `obsidian_list` - 列出文件
- `obsidian_search` - 搜索文件
- `obsidian_fulltext_search` - 全文搜索

### 2. REST API

提供 HTTP 接口用于调试和集成：
- `GET /health` - 健康检查
- `GET /api/scan` - 扫描目录
- `GET /api/read` - 读取文件
- `POST /api/write` - 写入文件
- `GET /api/search` - 搜索文件
- `GET /api/tags` - 获取标签

---

## 技术栈

| 技术 | 用途 |
|------|------|
| Node.js 20+ | 运行时环境 |
| TypeScript 5+ | 类型安全 |
| @modelcontextprotocol/sdk | MCP SDK |
| Express | HTTP 服务器（可选） |
| gray-matter | Markdown Frontmatter 解析 |

---

## 目录结构

```
src/mcp/
└── server.ts    # MCP 服务器主逻辑
```

---

## MCP 协议实现

### 服务器启动

```typescript
// server.ts
const server = new Server(
  {
    name: "axi-docs-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},  // 声明支持工具
      resources: {},  // 声明支持资源
    },
  }
);
```

### 工具注册

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "obsidian_scan":
      return await handleScan(args);
    case "obsidian_read":
      return await handleRead(args);
    case "obsidian_write":
      return await handleWrite(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});
```

---

## 工具规范

### 工具注册格式

每个工具必须定义元数据：

```typescript
server.setTool("obsidian_read", {
  name: "obsidian_read",
  description: "读取 Obsidian 知识库中的文件",
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "文档源 ID",
      },
      path: {
        type: "string",
        description: "文件相对路径",
      },
    },
    required: ["source", "path"],
  },
});
```

### 工具响应格式

```typescript
interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}
```

---

## 核心工具实现

### obsidian_scan

**功能**：扫描指定目录，返回文件和文件夹列表

**参数**：
- `source` (string): 文档源 ID
- `path` (string, optional): 相对路径
- `filterTag` (string, optional): 按标签过滤

**返回**：目录树结构的 JSON

**实现要点**：
- 递归遍历目录
- 解析 Frontmatter 提取标签
- 过滤 `.md` 文件
- 返回相对路径

### obsidian_read

**功能**：读取指定文件的内容

**参数**：
- `source` (string): 文档源 ID
- `path` (string): 文件相对路径

**返回**：文件内容的文本

**实现要点**：
- 使用 `fs.readFile` 读取文件
- 解析 Frontmatter
- 返回完整内容
- 处理文件不存在错误

### obsidian_write

**功能**：写入或更新文件

**参数**：
- `source` (string): 文档源 ID
- `path` (string): 文件相对路径
- `content` (string): 文件内容

**返回**：成功/失败消息

**实现要点**：
- 创建父目录（如不存在）
- 使用 `fs.writeFile` 写入文件
- 验证 Frontmatter 格式
- 返回成功状态

### obsidian_search

**功能**：按文件名搜索

**参数**：
- `source` (string): 文档源 ID
- `query` (string): 搜索关键词
- `path` (string, optional): 搜索路径

**返回**：匹配的文件列表

**实现要点**：
- 使用模糊匹配
- 支持部分匹配
- 返回文件路径和元数据

### obsidian_fulltext_search

**功能**：全文搜索文件内容

**参数**：
- `source` (string): 文档源 ID
- `query` (string): 搜索关键词
- `path` (string, optional): 搜索路径

**返回**：匹配的文件和片段

**实现要点**：
- 读取所有 `.md` 文件
- 执行关键词匹配
- 返回匹配上下文
- 优化性能（缓存、并发）

---

## 错误处理

### 错误响应格式

```typescript
{
  content: [{
    type: "text",
    text: "Error: File not found"
  }],
  isError: true
}
```

### 错误类型

| 错误类型 | HTTP 状态码 | MCP 错误码 | 描述 |
|---------|-------------|-----------|------|
| 文件不存在 | 404 | FILE_NOT_FOUND | 请求的文件不存在 |
| 权限错误 | 403 | PERMISSION_DENIED | 没有访问权限 |
| 参数错误 | 400 | INVALID_PARAMS | 请求参数无效 |
| 服务器错误 | 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 认证机制

### Token 验证

```typescript
function validateToken(token: string): boolean {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    return false;  // 生产环境必须设置 Token
  }
  return token === authToken;
}
```

### 认证流程

1. 客户端请求包含 `Authorization` header
2. 服务器验证 Token
3. 有效则处理请求，否则返回 401

---

## REST API 实现

### HTTP 服务器

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tools: ['obsidian_read', 'obsidian_write'] });
});

// 读取文件
app.get('/api/read', async (req, res) => {
  const { source, path } = req.query;
  // ... 实现
});

app.listen(3010, () => {
  console.log('HTTP server started on port 3010');
});
```

### API 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查 | 否 |
| GET | `/api/scan` | 扫描目录 | 否 |
| GET | `/api/read` | 读取文件 | 否 |
| POST | `/api/write` | 写入文件 | 否 |
| GET | `/api/search` | 搜索文件 | 否 |
| GET | `/api/tags` | 获取标签 | 否 |
| GET | `/api/graph` | 获取知识图谱 | 否 |

---

## 性能优化

### 文件缓存

```typescript
const fileCache = new Map<string, string>();

async function readFileWithCache(path: string): Promise<string> {
  if (fileCache.has(path)) {
    return fileCache.get(path)!;
  }

  const content = await fs.readFile(path, 'utf-8');
  fileCache.set(path, content);
  return content;
}
```

### 并发处理

```typescript
const files = await Promise.all(
  filePaths.map(path => readFileWithCache(path))
);
```

### 增量扫描

记录文件修改时间，只扫描变更的文件：
```typescript
const fileStats = new Map<string, { mtime: number }>();

function shouldScan(path: string): boolean {
  const stat = fs.statSync(path);
  const cached = fileStats.get(path);
  return !cached || stat.mtimeMs > cached.mtime;
}
```

---

## 安全约束

| 约束 | 说明 |
|------|------|
| 路径遍历防护 | 验证路径在允许的目录内 |
| 文件类型限制 | 只允许 `.md` 文件写入 |
| 大小限制 | 限制单个文件大小（< 10MB） |
| 频率限制 | 限制 API 调用频率 |
| 日志记录 | 记录所有访问和错误 |

### 路径遍历防护

```typescript
import path from 'path';

function validatePath(userPath: string, basePath: string): boolean {
  const resolvedPath = path.resolve(basePath, userPath);
  return resolvedPath.startsWith(basePath);
}
```

---

## 测试

### 单元测试

```typescript
import { describe, it, expect } from 'vitest';
import { handleRead } from './server';

describe('obsidian_read', () => {
  it('reads existing file', async () => {
    const result = await handleRead({
      source: 'obsidian',
      path: 'test.md'
    });
    expect(result.isError).toBe(false);
  });

  it('returns error for non-existent file', async () => {
    const result = await handleRead({
      source: 'obsidian',
      path: 'nonexistent.md'
    });
    expect(result.isError).toBe(true);
  });
});
```

### 集成测试

```typescript
import { createMcpClient } from '@modelcontextprotocol/sdk/client';

describe('MCP Server Integration', () => {
  let client;

  beforeAll(async () => {
    client = await createMcpClient('http://localhost:3010/mcp');
  });

  it('scans directory', async () => {
    const result = await client.callTool('obsidian_scan', {
      source: 'obsidian'
    });
    expect(result.content).toBeDefined();
  });
});
```

---

## 开发工作流

### 启动开发服务器

```bash
# MCP 模式（stdio）
pnpm mcp

# HTTP 模式
pnpm mcp:http
```

### 测试

```bash
pnpm test             # 监听模式
pnpm test:run         # 单次运行
pnpm test:coverage    # 覆盖率报告
```

### 调试

```bash
# 启动 HTTP 服务器
pnpm mcp:http

# 测试端点
curl http://localhost:3010/health
curl "http://localhost:3010/api/read?source=obsidian&path=test.md"
```

---

## 常见任务

### 添加新的文档源

1. 在 `src/config/sources.ts` 中定义新文档源
2. 实现对应的工具函数
3. 注册工具到 MCP 服务器
4. 添加测试用例

### 添加新的工具

```typescript
// 1. 定义工具
server.setTool("my_tool", {
  name: "my_tool",
  description: "Tool description",
  inputSchema: { /* ... */ },
});

// 2. 实现处理函数
async function handleMyTool(args: any): Promise<ToolResponse> {
  // ... 实现
}

// 3. 注册到路由
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "my_tool":
      return await handleMyTool(request.params.arguments);
  }
});
```

### 优化性能

1. 添加文件缓存
2. 实现并发处理
3. 优化全文搜索算法
4. 添加索引

---

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|---------|------|
| `OBSIDIAN_PATH` | `./obsidian` | Obsidian Vault 路径 |
| `BLINKO_URL` | `http://localhost:1111` | Blinko 服务地址 |
| `BLINKO_TOKEN` | 空 | Blinko API Token |
| `BIND_ADDRESS` | `127.0.0.1` | 绑定地址 |
| `MCP_AUTH_TOKEN` | 自动生成 | MCP 访问 Token |
| `ANTHROPIC_API_KEY` | 空 | Anthropic API Key |

---

## 参考文档

- [MCP 协议规范](https://modelcontextprotocol.io)
- [MCP SDK 文档](https://github.com/modelcontextprotocol/typescript-sdk)
- [Express 文档](https://expressjs.com)

---

*最后更新：2026-03-26*
