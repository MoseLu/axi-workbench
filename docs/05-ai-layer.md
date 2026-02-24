# 第五章 AI 能力层详细设计

## 5.1 knowledge-base — RAG 知识库

> **定位**：平台的统一知识中枢。支持多种格式摄入，提供混合检索（向量 + 关键词），通过 gRPC 对外提供低延迟检索接口，被工作流引擎和 Agent 平台共同依赖。

### 完整目录结构

```
ai/knowledge-base/
├── src/
│   ├── ingestion/                      # 文档摄入管道
│   │   ├── loaders/
│   │   │   ├── base_loader.py          # 加载器抽象基类
│   │   │   ├── pdf_loader.py           # PyMuPDF（支持图文混合页面）
│   │   │   ├── markdown_loader.py      # 保留标题层级、代码块
│   │   │   ├── code_loader.py          # 语言自动检测 + 语法保留
│   │   │   ├── docx_loader.py          # python-docx
│   │   │   ├── web_loader.py           # PlaywrightCrawler（JS 渲染页面）
│   │   │   └── loader_factory.py       # 根据 MIME 类型选择加载器
│   │   ├── chunkers/
│   │   │   ├── base_chunker.py
│   │   │   ├── recursive_chunker.py    # 按分隔符递归分块（默认 512 tokens，重叠 50）
│   │   │   ├── semantic_chunker.py     # 基于句向量相似度的语义边界检测
│   │   │   └── code_chunker.py         # AST 级别（函数/类/方法 为单元）
│   │   ├── enrichers/
│   │   │   ├── metadata_extractor.py   # 来源、日期、标题、章节层级
│   │   │   └── title_extractor.py      # 从内容推断标题
│   │   └── pipeline.py                 # 摄入主流程（Load → Chunk → Enrich → Embed → Store）
│   │
│   ├── embeddings/
│   │   ├── base_embedder.py
│   │   ├── openai_embedder.py          # text-embedding-3-large (1536 维)，批量调用
│   │   ├── local_embedder.py           # BAAI/bge-m3，GPU 推理
│   │   └── cache.py                    # Redis 向量缓存（content_hash → vector）
│   │
│   ├── vector_store/
│   │   ├── qdrant_store.py             # Qdrant 增删改查封装
│   │   └── collection_manager.py       # 集合 CRUD + 配置管理
│   │
│   ├── retrieval/
│   │   ├── vector_retriever.py         # cosine 相似度检索（Qdrant）
│   │   ├── bm25_retriever.py           # BM25 关键词检索（PostgreSQL GIN Index）
│   │   ├── hybrid_retriever.py         # RRF 融合算法
│   │   └── reranker.py                 # Cross-Encoder 精排（ms-marco-MiniLM）
│   │
│   ├── api/
│   │   ├── http/
│   │   │   ├── main.py                 # FastAPI 应用 (:8090)
│   │   │   └── routers/
│   │   │       ├── search.py           # 搜索接口
│   │   │       ├── ingest.py           # 文档摄入接口
│   │   │       └── collections.py      # 集合管理接口
│   │   └── grpc/
│   │       ├── server.py               # gRPC 服务器 (:9090)
│   │       └── servicer.py             # gRPC 服务实现
│   │
│   ├── models/                         # SQLAlchemy ORM 模型
│   │   ├── document.py                 # Document（原始文件元数据）
│   │   ├── chunk.py                    # DocumentChunk（分块内容，含全文索引）
│   │   └── ingestion_job.py            # IngestionJob（摄入任务追踪）
│   │
│   └── config/
│       └── kb_config.yaml
│
├── proto/
│   └── knowledge.proto
├── pyproject.toml
└── Dockerfile
```

### proto/knowledge.proto

```protobuf
syntax = "proto3";
package knowledge.v1;

service KnowledgeService {
  rpc Search(SearchRequest) returns (SearchResponse);
  rpc IngestDocument(IngestRequest) returns (IngestResponse);
  rpc DeleteDocument(DeleteRequest) returns (DeleteResponse);
  rpc GetCollections(Empty) returns (CollectionsResponse);
}

message SearchRequest {
  string query = 1;
  string collection = 2;
  int32 top_k = 3;
  map<string, string> filters = 4;   // 元数据过滤
  SearchMode mode = 5;               // VECTOR | BM25 | HYBRID
}

message SearchResponse {
  repeated DocumentChunk chunks = 1;
  float search_latency_ms = 2;
}

message DocumentChunk {
  string id = 1;
  string content = 2;
  float score = 3;
  map<string, string> metadata = 4;
  string source_document_id = 5;
}
```

### 摄入管道详解

```
文档来源
  ├── 文件上传 (file-service Webhook)
  ├── Git 仓库 (定时拉取)
  ├── URL 列表 (WebCrawler)
  └── API 直接推送

       ↓ Loader（识别文件类型）
       ↓ Chunker（语义/代码/递归 分块）
       ↓ Enricher（提取/补充元数据）
       ↓ Embedder（批量向量化，缓存）
       ↓
  ┌────┴────┐
  │         │
Qdrant    PostgreSQL
(向量+元数据) (chunk 原文 + 全文索引)
```

**幂等性保证**：对 `sha256(file_content)` 哈希去重，相同内容不重复索引。

### 混合检索策略（Hybrid Search）

```
Query
  ├── 向量化 → Qdrant cosine 检索 → Top-20 候选（Dense Path）
  └── BM25 分词 → PostgreSQL 全文检索 → Top-20 候选（Sparse Path）

           ↓ RRF (k=60) 融合
         Top-10 融合结果

           ↓ Cross-Encoder 精排 (可选)
         Top-5 最终返回
```

**RRF 公式**：`score(d) = Σ 1 / (k + rank(d, list_i))`

### Collection 设计

| Collection | 存储内容 | 向量维度 | 说明 |
|-----------|---------|---------|------|
| `platform-docs` | 平台内部文档（架构、API、手册） | 1536 | 全员可读 |
| `project-{id}` | 各项目上传的业务文档 | 1536 | 项目成员隔离 |
| `code-snippets` | 代码库函数/类摘要 | 1536 | AST 级别分块 |
| `web-content` | 抓取的外部网页内容 | 1536 | 定期更新 |

### kb_config.yaml

```yaml
chunking:
  default_chunk_size: 512        # tokens
  chunk_overlap: 50
  separators: ["\n\n", "\n", " "]

embedding:
  provider: openai               # openai | local
  model: text-embedding-3-large
  batch_size: 100
  cache_ttl: 86400               # seconds

retrieval:
  default_top_k: 5
  vector_top_k: 20
  bm25_top_k: 20
  rrf_k: 60
  rerank: true
  rerank_model: cross-encoder/ms-marco-MiniLM-L-6-v2
```

---

## 5.2 agent-platform — 智能协作平台

> **定位**：AI 智能执行核心。将复杂用户请求分解为多个子任务，调度专能 Agent 并行或串行执行，通过 Tool Interface 与其他服务交互，SSE 流式返回结果。

### 完整目录结构

```
ai/agent-platform/
├── src/
│   ├── orchestrator/
│   │   ├── planner.py              # 调用 LLM 分解任务，生成 ExecutionPlan（JSON）
│   │   ├── dispatcher.py           # 根据 Plan 创建 Agent 实例并调度
│   │   ├── state_machine.py        # 任务生命周期状态管理（transitions）
│   │   └── result_aggregator.py    # 多 Agent 结果汇总与格式化
│   │
│   ├── agents/
│   │   ├── base_agent.py           # 抽象基类（Tool 调用循环、上下文管理）
│   │   ├── code_agent.py           # 代码生成与重构
│   │   ├── docs_agent.py           # 文档生成与维护
│   │   ├── test_agent.py           # 测试用例生成
│   │   ├── review_agent.py         # Code Review
│   │   ├── research_agent.py       # 知识调研与检索
│   │   └── data_agent.py           # 数据分析
│   │
│   ├── tools/
│   │   ├── registry.py             # Tool 注册中心（自动发现 @tool_registry.register）
│   │   ├── base_tool.py            # Tool 抽象基类（含 input_schema 验证）
│   │   ├── kb_tools.py             # 知识库检索（调用 KB gRPC）
│   │   ├── code_tools.py           # 代码执行沙箱（Docker 隔离）
│   │   ├── git_tools.py            # Git 操作（clone/diff/blame/log）
│   │   ├── project_tools.py        # 调用 core-service（项目/任务读写）
│   │   ├── web_tools.py            # 网络搜索（Serper/Tavily API）
│   │   └── file_tools.py           # 调用 file-service（读写文件）
│   │
│   ├── memory/
│   │   ├── short_term.py           # 对话上下文（内存，含 Token 截断策略）
│   │   ├── working_memory.py       # 任务中间状态（Redis，含 TTL）
│   │   └── long_term.py            # 跨任务持久记忆（PostgreSQL + 向量化）
│   │
│   ├── api/
│   │   ├── main.py                 # FastAPI 应用 (:8091)
│   │   └── routers/
│   │       ├── chat.py             # 对话接口（SSE 流式）
│   │       ├── tasks.py            # 异步任务管理（创建/状态/取消）
│   │       └── sessions.py         # 会话管理（历史/清除）
│   │
│   ├── models/
│   │   ├── session.py              # AgentSession ORM
│   │   ├── task.py                 # AgentTask ORM
│   │   └── memory.py               # LongTermMemory ORM
│   │
│   └── config/
│       └── agent_config.yaml
│
├── pyproject.toml
└── Dockerfile
```

### Agent 类型详解

| Agent | 专能 | 主要 Tools | 典型用例 |
|-------|------|-----------|---------|
| `CodeAgent` | 代码生成与重构 | code_exec, git_tools, kb_tools | 根据需求描述生成代码框架 |
| `DocsAgent` | 文档生成与维护 | kb_tools, file_tools, project_tools | 自动更新 API 文档、生成 README |
| `TestAgent` | 测试用例生成 | code_tools, kb_tools | 为函数自动生成单元测试 |
| `ReviewAgent` | Code Review | git_tools, kb_tools, web_tools | PR 代码质量分析与建议 |
| `ResearchAgent` | 知识调研 | kb_tools, web_tools | 调研技术方案、汇总文档 |
| `DataAgent` | 数据分析 | code_exec, file_tools | 分析上传的数据文件、生成报告 |

### 编排器状态机

```
                        ┌──────────────┐
                        │   PENDING    │
                        └──────┬───────┘
                               │ 资源就绪
                        ┌──────▼───────┐
                        │   PLANNING   │ ← LLM 分解任务
                        └──────┬───────┘
                               │ 生成 ExecutionPlan
                        ┌──────▼───────┐
                        │ DISPATCHING  │ ← Agent 调度
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                   ┌────│   RUNNING    │────┐
                   │    └──────┬───────┘    │
              用户取消          │           出错
                   │    ┌──────▼───────┐    │
                   │    │ AGGREGATING  │    │
                   │    └──────┬───────┘    │
                   │           │            │
                   │    ┌──────▼───────┐    │
                   │    │  STREAMING   │    │
                   │    └──────┬───────┘    │
                   │           │            │
              ┌────▼────┐  ┌───▼─────┐  ┌──▼────┐
              │CANCELLED│  │COMPLETED│  │FAILED │
              └─────────┘  └─────────┘  └───────┘
```

### Tool 注册与调用规范

```python
# tools/base_tool.py
from abc import ABC, abstractmethod
from pydantic import BaseModel

class BaseTool(ABC):
    name: str
    description: str
    input_schema: type[BaseModel]

    @abstractmethod
    async def execute(self, **kwargs) -> dict:
        ...

# tools/kb_tools.py
@tool_registry.register
class KBSearchTool(BaseTool):
    name = "kb_search"
    description = "在知识库中检索与问题相关的文档片段"
    input_schema = KBSearchInput  # Pydantic 模型，自动生成 JSON Schema

    async def execute(self, query: str, collection: str = "platform-docs", top_k: int = 5):
        response = await kb_grpc_client.Search(
            SearchRequest(query=query, collection=collection, top_k=top_k)
        )
        return {"chunks": [c.model_dump() for c in response.chunks]}
```

### agent_config.yaml

```yaml
default_model: claude-sonnet-4-5
fallback_model: claude-haiku-4-5

agents:
  code_agent:
    system_prompt_template: "prompts/code_agent.md"
    max_tokens: 4096
    temperature: 0.2
    tools: [kb_search, code_exec, git_diff]

  review_agent:
    system_prompt_template: "prompts/review_agent.md"
    max_tokens: 8192
    temperature: 0.1
    tools: [kb_search, git_diff, git_log, web_search]

limits:
  max_tool_calls_per_turn: 20
  max_turns: 10
  session_token_budget: 200000   # 每 session 最大 token 用量
  user_daily_token_budget: 500000
```

### SSE 流式接口

```
POST /api/v1/agents/chat
Content-Type: application/json

{
  "session_id": "...",
  "message": "帮我给 ProjectController 生成单元测试",
  "agent_type": "test_agent",          // 可选，默认 auto-detect
  "context": { "project_id": "..." }
}

Response: text/event-stream

data: {"type": "thinking", "content": "正在分析代码结构..."}
data: {"type": "tool_call", "tool": "kb_search", "input": {...}}
data: {"type": "tool_result", "tool": "kb_search", "output": {...}}
data: {"type": "text", "content": "根据分析，以下是生成的测试代码：\n"}
data: {"type": "text", "content": "```java\n@SpringBootTest\n..."}
data: {"type": "done", "usage": {"input_tokens": 2048, "output_tokens": 512}}
```

---

[← 上一章](./04-backend.md) · [下一章：基础设施与运维设计 →](./06-infrastructure.md)
