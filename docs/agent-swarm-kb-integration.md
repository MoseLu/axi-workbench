# Agent 蜂群 × 知识库融合架构设计

**EPAP Agent Platform — Context-Aware Swarm with Persistent Memory**
版本 v2.0.0 | 2025

---

## 一、设计目标

在原有 Agent 蜂群架构的基础上，融入**知识库上下文注入**与**持久化记忆**能力，实现：

- Agent 自由读写 MongoDB，随时获取项目上下文（设计系统、组件、函数库等）
- 任务断点续传：任务中断后可从上次状态恢复，无需重新开始
- 项目资产库：图标、组件、Design Token、函数等统一存储，Agent 开箱即用
- 任务历史沉淀：每次执行结果自动入库，形成项目知识的滚雪球效应
- Agent 快速上手：新 Agent 实例接手任务时，能在秒级内理解整个项目状态

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (Web UI)                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  主 Orchestrator 面板      │   动态子 Agent 面板区           │    │
│  │                           │  ┌──────┐ ┌──────┐ ┌──────┐   │    │
│  │  [任务输入]               │  │Agent1│ │Agent2│ │Agent3│   │    │
│  │  [思考流 / 规划]          │  │流式  │ │流式  │ │流式  │   │    │
│  │  [断点状态指示器]         │  └──────┘ └──────┘ └──────┘   │    │
│  │  [最终汇总]               │                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────────────┘
                         │  WebSocket
┌────────────────────────▼─────────────────────────────────────────────┐
│                    Backend Orchestration Layer                        │
│                                                                      │
│   WebSocket Server                                                   │
│        │                                                             │
│        ▼                                                             │
│   Orchestrator  ──► Context Loader ──► MongoDB (项目上下文)           │
│        │                                                             │
│        ▼                                                             │
│   Task Checkpoint Manager ──► MongoDB (任务状态快照)                  │
│        │                                                             │
│        ├──► spawn_agent(task + injected_context)                     │
│        │                                                             │
│   Sub Agent Pool (并行)                                               │
│        │                                                             │
│        ▼                                                             │
│   Result Aggregator ──► MongoDB (结果持久化 → 知识沉淀)               │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
        Anthropic API          MongoDB Atlas
        (LLM 调用)             (持久化上下文)
```

---

## 三、MongoDB 数据库设计

### 3.1 数据库总览

```
epap_knowledge/
  ├── project_assets        # 项目资产库（组件、图标、Token、函数）
  ├── task_sessions         # 任务会话（断点续传）
  ├── task_history          # 任务执行历史
  ├── agent_context_cache   # Agent 上下文缓存
  └── project_registry      # 项目元信息注册表
```

---

### 3.2 Collection: project_assets（项目资产库）

Agent 执行任务时最核心的参考资源，包含项目中所有可复用的设计与代码单元。

```javascript
// 示例文档结构
{
  _id: ObjectId("..."),
  projectId: "epap-main",
  category: "component",         // component | icon | design-token | function | api-spec | schema
  name: "DataTable",
  namespace: "@eap/ui-components",
  
  // 资产核心内容
  content: {
    code: "export const DataTable = ...",   // 完整源码
    signature: "DataTable<T>(props: DataTableProps<T>): JSX.Element",
    description: "支持排序/过滤/分页的数据表格组件",
    props: [
      { name: "columns", type: "ColumnDef<T>[]", required: true },
      { name: "data", type: "T[]", required: true },
      { name: "pagination", type: "PaginationConfig", required: false }
    ],
    examples: ["<DataTable columns={cols} data={rows} />"],
    filePath: "packages/ui-components/src/composed/DataTable.tsx"
  },
  
  // 向量嵌入（供语义检索）
  embedding: [0.023, -0.17, ...],   // 1536 维
  
  // 关系图谱
  dependencies: ["Button", "Checkbox", "Skeleton"],
  usedBy: ["ProjectListPage", "UserTable", "AuditLogPage"],
  
  // 元数据
  tags: ["table", "data", "pagination"],
  version: "2.1.0",
  lastUpdated: ISODate("2025-01-15"),
  updatedBy: "agent:code-agent-003",
  
  // 质量指标
  quality: {
    testCoverage: 87,
    hasStorybook: true,
    hasTypings: true,
    complexity: "medium"
  }
}
```

**Design Token 示例：**

```javascript
{
  category: "design-token",
  name: "color.brand.primary",
  content: {
    value: "#2563EB",
    cssVar: "--color-brand-primary",
    tailwindClass: "bg-blue-600",
    usageContext: "主要按钮、链接、焦点环",
    darkModeValue: "#3B82F6"
  },
  group: "color.brand",
  tags: ["color", "brand", "primary"]
}
```

**函数库示例：**

```javascript
{
  category: "function",
  name: "useDebounce",
  namespace: "@eap/utils",
  content: {
    code: "export function useDebounce<T>(value: T, delay: number): T { ... }",
    signature: "useDebounce<T>(value: T, delay: number): T",
    description: "防抖 Hook，delay ms 内无变化后才更新返回值",
    examples: ["const debouncedQuery = useDebounce(searchQuery, 300)"],
    filePath: "packages/utils/src/async.ts"
  }
}
```

---

### 3.3 Collection: task_sessions（任务断点续传核心）

```javascript
{
  _id: ObjectId("..."),
  sessionId: "sess_20250115_abc123",
  projectId: "epap-main",
  
  // 任务元信息
  task: {
    original: "实现用户管理模块，包括列表、编辑、权限配置",
    breakdown: [
      "实现 UserTable 组件（DataTable 封装）",
      "实现 UserForm 组件（创建/编辑）",
      "实现 RBAC 权限选择器",
      "对接 auth-service API"
    ]
  },
  
  // 断点状态机
  status: "paused",    // pending | planning | running | paused | completed | failed
  checkpoint: {
    phase: "execution",          // planning | execution | aggregation
    completedSubtasks: [
      {
        agentId: "agent-001",
        task: "实现 UserTable 组件",
        status: "completed",
        resultRef: "task_history/result_abc001",   // 结果指针，不直接存大数据
        completedAt: ISODate("2025-01-15T10:23:00")
      }
    ],
    pendingSubtasks: [
      {
        agentId: null,           // 尚未分配
        task: "实现 UserForm 组件",
        status: "pending",
        dependencies: []
      },
      {
        agentId: null,
        task: "实现 RBAC 权限选择器",
        status: "pending",
        dependencies: ["UserForm"]
      }
    ],
    lastActiveAt: ISODate("2025-01-15T10:25:00"),
    pauseReason: "user_interrupt"   // user_interrupt | timeout | error | api_limit
  },
  
  // 完整对话历史（断点续传时直接恢复）
  orchestratorHistory: [
    { role: "user", content: "实现用户管理模块..." },
    { role: "assistant", content: "我来分析任务结构...", tool_use: [...] },
    { role: "user", content: [{ type: "tool_result", ... }] }
  ],
  
  // 会话级上下文快照（恢复时注入）
  contextSnapshot: {
    injectedAssets: ["UserTable_schema", "auth_service_openapi"],
    relevantComponents: ["DataTable", "Form", "Dialog"],
    relevantAPIs: ["GET /users", "POST /users", "PUT /users/:id"]
  },
  
  createdAt: ISODate("2025-01-15T10:20:00"),
  expiresAt: ISODate("2025-01-22T10:20:00")   // 7 天后过期
}
```

---

### 3.4 Collection: task_history（知识沉淀库）

```javascript
{
  _id: ObjectId("..."),
  historyId: "hist_20250115_xyz789",
  sessionId: "sess_20250115_abc123",
  projectId: "epap-main",
  
  // 任务摘要
  summary: {
    taskDescription: "实现 UserTable 组件",
    agentRole: "code_agent",
    outcome: "success",
    duration: 142,   // 秒
    tokensUsed: 8432
  },
  
  // 执行过程（用于后续 Agent 参考）
  execution: {
    approach: "基于 @eap/ui-components 的 DataTable 封装，增加用户状态徽章和操作列",
    decisionPoints: [
      "选择 DataTable 而非手写 <table>，因项目已有封装",
      "状态徽章复用 Badge 组件",
      "操作列使用 Dropdown 而非内联按钮，节省空间"
    ],
    toolsUsed: ["kb_search", "code_tools", "project_tools"]
  },
  
  // 产出物（核心内容）
  artifacts: [
    {
      type: "component",
      name: "UserTable",
      filePath: "apps/admin-dashboard/src/features/user-management/components/UserTable.tsx",
      code: "...",    // 完整代码
      codeHash: "sha256:abc...",   // 去重用
      linesOfCode: 127
    }
  ],
  
  // 遇到的问题与解决方案（最有价值的知识）
  lessonsLearned: [
    {
      problem: "DataTable 的 ColumnDef 类型在 User 模型中有嵌套对象，需要自定义 cell renderer",
      solution: "使用 cell: ({ row }) => <Badge>{row.original.role.name}</Badge>",
      reusable: true,
      tags: ["DataTable", "nested-object", "cell-renderer"]
    }
  ],
  
  // 向量嵌入（供语义检索）
  embedding: [0.031, -0.092, ...],
  
  tags: ["user-management", "component", "admin-dashboard"],
  createdAt: ISODate("2025-01-15T10:45:00")
}
```

---

### 3.5 Collection: project_registry（项目元信息）

Agent 接手新项目时第一个加载的文档，提供快速上手所需的全局视图。

```javascript
{
  _id: ObjectId("..."),
  projectId: "epap-main",
  name: "Enterprise Project Automation Platform",
  
  // 技术栈速查（Agent 初始化必读）
  techStack: {
    frontend: {
      framework: "React 18 + TypeScript 5",
      build: "Vite 5 + Turborepo",
      styling: "Tailwind CSS",
      stateManagement: "Zustand + TanStack Query",
      componentLibrary: "@eap/ui-components (Radix UI base)",
      formLibrary: "React Hook Form + Zod",
      routing: "React Router v6"
    },
    backend: {
      gateway: "Go + Gin",
      coreService: "Java 21 + Spring Boot 3",
      workflows: "Python + FastAPI + Celery",
      ai: "Python + Anthropic SDK"
    },
    database: {
      primary: "PostgreSQL 16",
      cache: "Redis 7",
      vector: "Qdrant",
      messageQueue: "Kafka",
      objectStorage: "MinIO (S3 compatible)",
      agentMemory: "MongoDB"
    }
  },
  
  // 代码规范（Agent 必须遵守）
  conventions: {
    naming: {
      components: "PascalCase",
      hooks: "camelCase，以 use 开头",
      files: "PascalCase.tsx（组件），camelCase.ts（工具）",
      cssClasses: "Tailwind utility classes，禁止魔法字符串"
    },
    structure: {
      featureModule: "components/ | pages/ | hooks/ | store/ | index.ts",
      apiRoutes: "/api/v1/{resource}/{id}，RESTful 风格",
      schemaFirst: "所有接口先定义 Zod schema，再写实现"
    },
    imports: {
      aliasPrefix: "@/",
      barrelExport: "每个 feature 必须有 index.ts 统一导出"
    }
  },
  
  // 可用 API 端点速查
  apiEndpoints: {
    gateway: "http://api-gateway:8080",
    auth: "http://auth-service:8081",
    core: "http://core-service:8082",
    workflow: "http://workflow-engine:8083",
    knowledge: "http://knowledge-base:8090",
    agent: "http://agent-platform:8091"
  },
  
  // 已实现功能状态
  implementedFeatures: [
    { name: "用户认证", status: "completed", path: "src/features/auth" },
    { name: "项目管理", status: "completed", path: "src/features/projects" },
    { name: "用户管理", status: "in_progress", path: "src/features/user-management" }
  ],
  
  // Agent 注意事项（过往 Agent 总结的踩坑记录）
  agentNotes: [
    "DataTable 分页必须通过 onPaginationChange 回调受控，不要用内置状态",
    "所有异步操作必须用 TanStack Query，禁止直接 useEffect + fetch",
    "Kafka topic 命名格式：{service}.{entity}.{event}，如 core.project.created",
    "环境变量命名：VITE_前缀（前端），全大写下划线（后端）"
  ],
  
  lastSyncedAt: ISODate("2025-01-15T00:00:00")
}
```

---

## 四、Context Loader：上下文注入机制

Agent 每次执行任务前，Context Loader 自动完成以下步骤：

```python
class ContextLoader:
    """
    在任务执行前，从 MongoDB 检索并组装最相关的上下文
    """
    
    async def load_for_task(self, task: str, project_id: str) -> InjectedContext:
        
        # 1. 加载项目元信息（全量，通常 < 2KB）
        registry = await self.mongo.project_registry.find_one(
            {"projectId": project_id}
        )
        
        # 2. 语义检索最相关的资产（向量相似度 Top-10）
        task_embedding = await self.embedder.embed(task)
        relevant_assets = await self.mongo.project_assets.aggregate([
            {
                "$vectorSearch": {
                    "index": "asset_vector_index",
                    "path": "embedding",
                    "queryVector": task_embedding,
                    "numCandidates": 50,
                    "limit": 10,
                    "filter": {"projectId": project_id}
                }
            }
        ]).to_list()
        
        # 3. 检索相关历史任务（学习过往经验）
        similar_history = await self.mongo.task_history.aggregate([
            {
                "$vectorSearch": {
                    "index": "history_vector_index", 
                    "path": "embedding",
                    "queryVector": task_embedding,
                    "numCandidates": 30,
                    "limit": 5,
                    "filter": {
                        "projectId": project_id,
                        "summary.outcome": "success"   # 只参考成功案例
                    }
                }
            }
        ]).to_list()
        
        # 4. 组装为结构化上下文字符串
        return InjectedContext(
            project_overview=self._format_registry(registry),
            relevant_assets=self._format_assets(relevant_assets),
            past_solutions=self._format_history(similar_history),
            token_estimate=self._count_tokens(...)
        )
    
    def _format_as_system_prompt(self, ctx: InjectedContext) -> str:
        return f"""
## 项目概览
{ctx.project_overview}

## 本任务相关的已有资产
以下组件/函数/Token 与你的任务高度相关，优先复用，不要重复造轮子：
{ctx.relevant_assets}

## 相似任务的历史解决方案（参考，不要照抄）
{ctx.past_solutions}

## 编码规范
{ctx.conventions}
"""
```

---

## 五、断点续传实现

### 5.1 任务暂停（保存断点）

```python
async def pause_session(session_id: str, reason: str):
    """
    任何中断（用户手动、超时、API 限制、错误）都调用此函数
    """
    session = await sessions_col.find_one({"sessionId": session_id})
    
    await sessions_col.update_one(
        {"sessionId": session_id},
        {"$set": {
            "status": "paused",
            "checkpoint.pauseReason": reason,
            "checkpoint.lastActiveAt": datetime.utcnow(),
            # 保存完整的 Orchestrator 对话历史
            "orchestratorHistory": current_messages,
            # 保存已完成/未完成的子任务状态
            "checkpoint.completedSubtasks": completed_tasks,
            "checkpoint.pendingSubtasks": pending_tasks
        }}
    )
    
    # 通知前端：会话已暂停，可随时继续
    await ws.send(json.dumps({
        "type": "session_paused",
        "sessionId": session_id,
        "reason": reason,
        "resumeUrl": f"/sessions/{session_id}/resume"
    }))
```

### 5.2 任务恢复（从断点继续）

```python
async def resume_session(session_id: str, ws):
    """
    从上次断点恢复，无需重新描述任务
    """
    session = await sessions_col.find_one({"sessionId": session_id})
    
    if not session or session["status"] != "paused":
        raise ValueError("会话不存在或无法恢复")
    
    # 通知前端：恢复执行
    await ws.send(json.dumps({
        "type": "session_resuming",
        "sessionId": session_id,
        "completedCount": len(session["checkpoint"]["completedSubtasks"]),
        "pendingCount": len(session["checkpoint"]["pendingSubtasks"])
    }))
    
    # 恢复主 Orchestrator（使用保存的完整历史，LLM 立刻知道做到哪里了）
    messages = session["orchestratorHistory"]
    pending = session["checkpoint"]["pendingSubtasks"]
    
    # 注入续传提示（让 Orchestrator 知道是从断点恢复）
    messages.append({
        "role": "user",
        "content": f"""
任务已从断点恢复。
已完成的子任务：{[t['task'] for t in session['checkpoint']['completedSubtasks']]}
还需完成的子任务：{[t['task'] for t in pending]}
请继续执行剩余任务。
        """
    })
    
    # 继续执行主循环
    await run_swarm_loop(messages, session_id, ws)
```

---

## 六、完整后端实现（含 MongoDB 集成）

```python
import asyncio
import json
from uuid import uuid4
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import anthropic
import websockets

# ─── 初始化 ────────────────────────────────────────────────────────────

claude = anthropic.Anthropic()
mongo = AsyncIOMotorClient("mongodb://localhost:27017")
db = mongo.epap_knowledge

# Collections
assets_col = db.project_assets
sessions_col = db.task_sessions
history_col = db.task_history
registry_col = db.project_registry

# ─── Tools ─────────────────────────────────────────────────────────────

ORCHESTRATOR_TOOLS = [
    {
        "name": "spawn_agent",
        "description": "创建子Agent执行子任务。Agent会自动获得项目上下文。",
        "input_schema": {
            "type": "object",
            "properties": {
                "task": {"type": "string", "description": "子任务完整描述"},
                "role": {"type": "string", "description": "agent角色：code_agent|docs_agent|test_agent|review_agent"},
                "context_hints": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "提示Context Loader重点检索的关键词"
                }
            },
            "required": ["task", "role"]
        }
    },
    {
        "name": "query_knowledge",
        "description": "主动查询项目知识库，获取特定资产或历史",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "category": {"type": "string", "enum": ["component", "function", "design-token", "api-spec", "task-history"]}
            },
            "required": ["query"]
        }
    },
    {
        "name": "save_checkpoint",
        "description": "主动保存当前进度快照（长任务中途建议调用）",
        "input_schema": {
            "type": "object",
            "properties": {
                "note": {"type": "string", "description": "快照说明"}
            }
        }
    }
]

# ─── Context Loader ─────────────────────────────────────────────────────

async def load_context(task: str, project_id: str, hints: list[str] = []) -> str:
    """从 MongoDB 检索并组装任务上下文"""
    
    # 加载项目元信息
    registry = await registry_col.find_one({"projectId": project_id})
    
    # 关键词检索相关资产（简化版，生产环境换向量检索）
    search_terms = hints if hints else task.split()[:5]
    assets = await assets_col.find({
        "projectId": project_id,
        "tags": {"$in": search_terms}
    }).limit(8).to_list(None)
    
    # 检索相关历史任务
    history = await history_col.find({
        "projectId": project_id,
        "tags": {"$in": search_terms},
        "summary.outcome": "success"
    }).sort("createdAt", -1).limit(3).to_list(None)
    
    # 组装上下文
    ctx_parts = []
    
    if registry:
        ctx_parts.append(f"""## 项目技术栈
前端：{registry['techStack']['frontend']['framework']}，
组件库：{registry['techStack']['frontend']['componentLibrary']}
样式：{registry['techStack']['frontend']['styling']}

## 编码规范（必须遵守）
命名：{json.dumps(registry['conventions']['naming'], ensure_ascii=False)}
结构：{json.dumps(registry['conventions']['structure'], ensure_ascii=False)}

## Agent 注意事项
{chr(10).join('- ' + n for n in registry.get('agentNotes', []))}""")
    
    if assets:
        ctx_parts.append("## 相关资产（优先复用）")
        for a in assets:
            ctx_parts.append(f"### {a['name']} ({a['category']})\n"
                           f"描述：{a['content']['description']}\n"
                           f"签名：{a['content'].get('signature', '')}\n"
                           f"用法：{a['content'].get('examples', [''])[0]}")
    
    if history:
        ctx_parts.append("## 相似任务的历史解决方案")
        for h in history:
            ctx_parts.append(f"**{h['summary']['taskDescription']}**\n"
                           f"方案：{h['execution']['approach']}\n"
                           f"经验：{h['lessonsLearned'][0]['solution'] if h.get('lessonsLearned') else ''}")
    
    return "\n\n".join(ctx_parts)


# ─── 子 Agent 执行器 ────────────────────────────────────────────────────

async def run_sub_agent(agent_id: str, call, ws, project_id: str) -> dict:
    """每个子 Agent 自动注入项目上下文后执行"""
    
    # 1. 加载上下文
    context = await load_context(
        task=call.input["task"],
        project_id=project_id,
        hints=call.input.get("context_hints", [])
    )
    
    await ws.send(json.dumps({
        "type": "agent_context_loaded",
        "agentId": agent_id,
        "assetsLoaded": context.count("###")   # 粗略统计
    }))
    
    # 2. 执行（携带上下文）
    full_result = ""
    with claude.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=8096,
        system=f"""你是一个 {call.input['role']}。

{context}

请基于以上项目上下文完成任务。遵守项目规范，优先复用已有资产。""",
        messages=[{"role": "user", "content": call.input["task"]}]
    ) as stream:
        for text in stream.text_stream:
            full_result += text
            await ws.send(json.dumps({
                "type": "sub_agent_token",
                "agentId": agent_id,
                "token": text
            }))
    
    # 3. 结果入库（知识沉淀）
    history_doc = {
        "historyId": f"hist_{datetime.utcnow().strftime('%Y%m%d')}_{uuid4().hex[:8]}",
        "projectId": project_id,
        "summary": {
            "taskDescription": call.input["task"],
            "agentRole": call.input["role"],
            "outcome": "success"
        },
        "execution": {
            "approach": full_result[:500],   # 摘要
        },
        "artifacts": [],    # 实际实现中解析代码块
        "lessonsLearned": [],
        "tags": call.input.get("context_hints", []),
        "createdAt": datetime.utcnow()
    }
    await history_col.insert_one(history_doc)
    
    await ws.send(json.dumps({"type": "agent_done", "agentId": agent_id}))
    return {"agentId": agent_id, "result": full_result, "historyId": history_doc["historyId"]}


# ─── 主 Orchestrator 循环 ───────────────────────────────────────────────

async def run_swarm(task: str, project_id: str, ws, session_id: str = None):
    """
    支持断点续传的主编排循环
    """
    # 新建 or 恢复会话
    if session_id:
        session = await sessions_col.find_one({"sessionId": session_id})
        messages = session["orchestratorHistory"]
        messages.append({"role": "user", "content": f"从断点恢复，继续执行剩余任务。"})
    else:
        session_id = f"sess_{datetime.utcnow().strftime('%Y%m%d')}_{uuid4().hex[:8]}"
        
        # 主 Orchestrator 也注入上下文
        orchestrator_context = await load_context(task, project_id)
        
        messages = [{
            "role": "user",
            "content": f"{task}\n\n---\n项目上下文（已自动加载）：\n{orchestrator_context}"
        }]
        
        # 创建会话记录
        await sessions_col.insert_one({
            "sessionId": session_id,
            "projectId": project_id,
            "task": {"original": task},
            "status": "running",
            "checkpoint": {"completedSubtasks": [], "pendingSubtasks": []},
            "orchestratorHistory": messages,
            "createdAt": datetime.utcnow()
        })
    
    await ws.send(json.dumps({
        "type": "session_started",
        "sessionId": session_id
    }))
    
    completed_subtasks = []
    
    while True:
        # 主 Agent 流式输出
        full_response = None
        with claude.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            tools=ORCHESTRATOR_TOOLS,
            system="""你是任务编排者（Orchestrator）。
自主决定是否拆分任务、拆几个、每个 Agent 的 role 和 context_hints。
遇到复杂任务时，使用 spawn_agent 并行分配。
定期调用 save_checkpoint 保存进度（每完成 2-3 个子任务后）。""",
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                await ws.send(json.dumps({"type": "main_agent_token", "token": text}))
            full_response = stream.get_final_message()
        
        if full_response.stop_reason == "end_turn":
            # 任务完成，保存最终状态
            await sessions_col.update_one(
                {"sessionId": session_id},
                {"$set": {
                    "status": "completed",
                    "orchestratorHistory": messages,
                    "completedAt": datetime.utcnow()
                }}
            )
            await ws.send(json.dumps({"type": "done", "sessionId": session_id}))
            break
        
        # 处理工具调用
        tool_calls = [b for b in full_response.content if b.type == "tool_use"]
        spawn_calls = [c for c in tool_calls if c.name == "spawn_agent"]
        other_calls = [c for c in tool_calls if c.name != "spawn_agent"]
        
        tool_results = []
        
        # 处理 save_checkpoint
        for call in other_calls:
            if call.name == "save_checkpoint":
                await sessions_col.update_one(
                    {"sessionId": session_id},
                    {"$set": {
                        "orchestratorHistory": messages,
                        "checkpoint.completedSubtasks": completed_subtasks,
                        "checkpoint.lastActiveAt": datetime.utcnow()
                    }}
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": "断点已保存"
                })
            
            elif call.name == "query_knowledge":
                assets = await assets_col.find({
                    "projectId": project_id,
                    "$text": {"$search": call.input["query"]}
                }).limit(5).to_list(None)
                result = "\n".join([
                    f"- {a['name']}: {a['content']['description']}"
                    for a in assets
                ])
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": result or "未找到相关资产"
                })
        
        # 并行启动所有子 Agent
        if spawn_calls:
            agent_ids = []
            for call in spawn_calls:
                agent_id = uuid4().hex[:8]
                agent_ids.append(agent_id)
                await ws.send(json.dumps({
                    "type": "agent_spawned",
                    "agentId": agent_id,
                    "task": call.input["task"],
                    "role": call.input["role"]
                }))
            
            sub_results = await asyncio.gather(*[
                run_sub_agent(aid, call, ws, project_id)
                for aid, call in zip(agent_ids, spawn_calls)
            ])
            
            for call, res in zip(spawn_calls, sub_results):
                completed_subtasks.append({
                    "task": call.input["task"],
                    "agentId": res["agentId"],
                    "historyId": res["historyId"],
                    "status": "completed"
                })
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": res["result"]
                })
        
        # 继续主循环
        messages.append({"role": "assistant", "content": full_response.content})
        messages.append({"role": "user", "content": tool_results})
        
        # 每轮自动更新会话历史（确保可恢复）
        await sessions_col.update_one(
            {"sessionId": session_id},
            {"$set": {
                "orchestratorHistory": messages,
                "checkpoint.completedSubtasks": completed_subtasks
            }}
        )


# ─── WebSocket Handler ──────────────────────────────────────────────────

async def websocket_handler(websocket, path):
    async for message in websocket:
        data = json.loads(message)
        
        if data["type"] == "user_input":
            await run_swarm(
                task=data["content"],
                project_id=data.get("projectId", "epap-main"),
                ws=websocket
            )
        
        elif data["type"] == "resume_session":
            await run_swarm(
                task="",
                project_id=data.get("projectId", "epap-main"),
                ws=websocket,
                session_id=data["sessionId"]
            )


async def main():
    async with websockets.serve(websocket_handler, "0.0.0.0", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 七、项目资产入库脚本（初始化知识库）

执行一次，将整个代码库的资产扫描并入库：

```python
# tools/scripts/sync_assets_to_mongodb.py
import ast
import os
from pathlib import Path

async def sync_project_assets(project_root: str, project_id: str):
    """
    扫描代码库，将组件、函数、Design Token 等资产同步到 MongoDB
    """
    
    # 1. 同步 React 组件
    for tsx_file in Path(project_root).rglob("*.tsx"):
        if "test" in str(tsx_file) or "stories" in str(tsx_file):
            continue
        
        component_name = tsx_file.stem
        code = tsx_file.read_text()
        
        # 提取 props 类型（简化版）
        description = extract_jsdoc_description(code)
        
        await assets_col.update_one(
            {"projectId": project_id, "name": component_name},
            {"$set": {
                "projectId": project_id,
                "category": "component",
                "name": component_name,
                "content": {
                    "code": code,
                    "description": description or f"{component_name} 组件",
                    "filePath": str(tsx_file.relative_to(project_root))
                },
                "tags": extract_tags(component_name, code),
                "lastUpdated": datetime.utcnow()
            }},
            upsert=True
        )
    
    # 2. 同步 Design Tokens（从 tailwind.config.ts 提取）
    tailwind_config = Path(project_root) / "packages/ui-components/tailwind.config.ts"
    if tailwind_config.exists():
        tokens = parse_tailwind_tokens(tailwind_config.read_text())
        for token in tokens:
            await assets_col.update_one(
                {"projectId": project_id, "name": token["name"]},
                {"$set": {**token, "projectId": project_id, "category": "design-token"}},
                upsert=True
            )
    
    print(f"资产同步完成，项目：{project_id}")
```

---

## 八、MongoDB 索引配置

```javascript
// 在 MongoDB Atlas 或本地执行
db.project_assets.createIndex({ "projectId": 1, "category": 1 });
db.project_assets.createIndex({ "tags": 1 });
db.project_assets.createIndex({ "name": "text", "content.description": "text" });
// Atlas Vector Search 索引（需在 Atlas UI 创建）
// { "fields": [{ "path": "embedding", "numDimensions": 1536, "similarity": "cosine" }] }

db.task_sessions.createIndex({ "sessionId": 1 }, { unique: true });
db.task_sessions.createIndex({ "projectId": 1, "status": 1 });
db.task_sessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });  // TTL 自动清理

db.task_history.createIndex({ "projectId": 1, "tags": 1 });
db.task_history.createIndex({ "createdAt": -1 });
// Atlas Vector Search: history_vector_index on "embedding"

db.project_registry.createIndex({ "projectId": 1 }, { unique: true });
```

---

## 九、前端 UI 增强（断点续传 + 知识库状态）

```tsx
interface Session {
  sessionId: string
  status: "running" | "paused" | "completed"
  completedCount: number
  pendingCount: number
}

export default function AgentSwarmUI() {
  const [session, setSession] = useState<Session | null>(null)
  const [panels, setPanels] = useState<Record<string, Panel>>({})
  const [pastSessions, setPastSessions] = useState<Session[]>([])

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    switch (msg.type) {
      
      case "session_started":
        setSession({ sessionId: msg.sessionId, status: "running", ... })
        break
      
      case "session_paused":
        setSession(prev => ({ ...prev!, status: "paused" }))
        // 显示"已暂停，点击继续"的 Banner
        break
      
      case "agent_context_loaded":
        // 在子面板上显示"已加载 N 个相关资产"
        setPanels(prev => ({
          ...prev,
          [msg.agentId]: { ...prev[msg.agentId], contextLoaded: msg.assetsLoaded }
        }))
        break
      
      case "agent_spawned":
        setPanels(prev => ({
          ...prev,
          [msg.agentId]: {
            task: msg.task, role: msg.role,
            content: "", done: false, contextLoaded: 0
          }
        }))
        break
    }
  }

  const handleResume = (sessionId: string) => {
    ws.send(JSON.stringify({ type: "resume_session", sessionId }))
  }

  return (
    <div className="swarm-ui">
      {/* 断点续传：历史会话列表 */}
      {pastSessions.filter(s => s.status === "paused").map(s => (
        <div key={s.sessionId} className="resume-banner">
          ⏸ 未完成的任务（{s.completedCount} 已完成，{s.pendingCount} 待处理）
          <button onClick={() => handleResume(s.sessionId)}>继续执行</button>
        </div>
      ))}
      
      {/* 主面板 + 子 Agent 面板 */}
      <MainPanel />
      <SubAgentPanels panels={panels} />
    </div>
  )
}
```

---

## 十、与 EPAP 架构的集成映射

| EPAP 原有模块 | 本方案对应位置 | 集成说明 |
|---|---|---|
| `ai/agent-platform` | 主编排逻辑 | `run_swarm()` 替换原 `orchestrator/` |
| `ai/knowledge-base` | 向量检索 | Context Loader 调用 KB gRPC 进行语义检索 |
| MongoDB | 新增 `epap_knowledge` 数据库 | 独立于 PostgreSQL，专职 Agent 记忆 |
| `ai/agent-platform/src/memory/` | 三层记忆 | short_term → 会话消息；working_memory → task_sessions；long_term → task_history |
| `tools/scripts/` | 资产同步脚本 | `sync_assets_to_mongodb.py` 定期/触发执行 |
| `ai/agent-platform/src/api/routers/sessions.py` | 断点续传 API | 新增 `POST /sessions/{id}/resume` |

---

## 十一、关键特性总结

| 特性 | 实现机制 |
|---|---|
| **上下文自动注入** | Context Loader 在每个子 Agent 启动前语义检索 MongoDB，注入 system prompt |
| **断点续传** | 每轮对话后更新 `task_sessions`，中断后可从任意节点恢复 |
| **项目资产库** | 一次性扫描入库，Agent 检索后直接复用，不重复造轮子 |
| **知识滚雪球** | 每次任务结果自动写入 `task_history`，后续 Agent 可参考 |
| **快速上手** | `project_registry` 包含全局约定，新 Agent 实例秒级获得完整项目认知 |
| **向量语义检索** | 资产和历史均存储 embedding，支持语义相似度检索（Atlas Vector Search）|
| **TTL 自动清理** | `task_sessions` 设置 7 天 TTL，过期自动删除 |
