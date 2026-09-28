---
stale-doc: true
stale-reason: 历史文档含 axiom-* 用法，未同步更新到 axi-* 命名约定
last-synced: 2026-09-25
synced-by: audit-remediation-2026-09-25
---

# axiom-agent Architecture

## Overview

axiom-agent is a multi-agent collaboration platform that enables autonomous software development through coordinated agent workflows. The system combines a Python/FastAPI backend with LangChain and ChromaDB, a TypeScript MCP server for tool integration, a React frontend, and an Electron desktop application for macOS.

```
/Volumes/code/workspace/agent-cluster/axi-agent/
├── backend/              # Python/FastAPI + LangChain + ChromaDB + SQLAlchemy
├── frontend/             # React/Vite web UI
├── infra/
│   └── axi-agent-mcp/    # TypeScript MCP Server
├── apps/
│   └── desktop-glass-ui/ # Electron macOS glass UI
├── chroma_db/            # ChromaDB persistent storage
└── docker-compose.yml
```

---

## Components

### backend/ - Python/FastAPI Backend

**Path**: `/Volumes/code/workspace/agent-cluster/axi-agent/backend/`

**Tech Stack**:
- FastAPI (web framework)
- LangChain `1.3.4` + langchain-community `0.4.2` + langchain-openai `1.2.2` (LLM orchestration)
- ChromaDB (vector database for memory)
- SQLAlchemy (ORM for persistent storage)

**Key API Routes** (`backend/app/api/`):

| File | Purpose |
|------|---------|
| `agents.py` | Agent CRUD operations |
| `tasks.py` | Task lifecycle management |
| `subagent.py` | SubAgent mode + worktree orchestration |
| `memory.py` | Vector memory operations |
| `dashboard.py` | Dashboard metrics |
| `workstation.py` | Workstation management |
| `mcp.py` | MCP server integration |

**Key Services** (`backend/app/core/`):

| File | Purpose |
|------|---------|
| `code_isolation_manager.py` | Git worktree isolation |
| `task_scheduler.py` | Task scheduling |
| `task_routing.py` | Task routing guard |
| `swarm_orchestrator.py` | Swarm orchestration |
| `memory_manager.py` | Session + long-term memory |
| `agent_manager.py` | Agent lifecycle |

**Database Models** (`backend/app/database/models.py`):
- `agents`, `tasks`, `task_route_decisions`, `tools`, `sessions`

**Vector Store** (`backend/app/database/vector_store.py`):
- Collection: `agent_memory`
- Config: `hnsw:space: cosine`
- Methods: `add_memory`, `search_memory`, `get_memory`, `delete_memory`

---

### infra/axi-agent-mcp/ - TypeScript MCP Server

**Path**: `/Volumes/code/workspace/agent-cluster/axi-agent/infra/axi-agent-mcp/`

**Tech Stack**: TypeScript, `@modelcontextprotocol/sdk`

**Entry**: `src/index.ts`

**9 Tool Categories** (defined in `src/tool-contract.ts`):

| Category | Tools |
|----------|-------|
| `model-routing` | `swarm_chat`, `analyze_task`, `stats`, `metrics`, `logs` |
| `workflow` | `execute`, `list`, `validate`, `catalog`, `recommend` |
| `workspace` | `read file`, `write file`, `search`, `index`, `analyze` |
| `git` | `status`, `commit`, `branch`, `MR description` |
| `ci` | `lint`, `test`, `autofix` |
| `agents` | `list`, `recommend`, `create_dynamic`, `execute_swarm` |
| `skills` | `list`, `execute` |
| `governance` | `list_gates`, `validate_with_gates` |
| `data` | `db_stats`, `vector_search`, `vector_upsert` |

**Key Services** (`src/`):

| File | Purpose |
|------|---------|
| `model-router.ts` | Model routing logic |
| `cost-monitor.ts` | Cost tracking |
| `embedding-client.ts` | Embedding generation |
| `workflow/engine.ts` | Workflow execution engine |

---

### frontend/ - React Web UI

**Path**: `/Volumes/code/workspace/agent-cluster/axi-agent/frontend/`

**Tech Stack**: React 18, TypeScript, Tailwind CSS, Zustand (state), Recharts (charts), Lucide React (icons)

**Key Pages** (`src/pages/`):

| File | Purpose |
|------|---------|
| `Chat.tsx` | Main chat interface |
| `Agents.tsx` | Agent management |
| `Tasks.tsx` | Task management |
| `Dashboard.tsx` | Metrics dashboard |
| `SubAgent.tsx` | SubAgent mode control |
| `Memory.tsx` | Memory visualization |

---

### apps/desktop-glass-ui/ - Electron macOS Desktop App

**Path**: `/Volumes/code/workspace/agent-cluster/axi-agent/apps/desktop-glass-ui/`

**Tech Stack**: Electron + Vite

**Entry**: `src/App.tsx` (~10KB)

Implements macOS glass morphism UI (blur effects, transparency) for desktop access.

---

## Agent System

### SubAgent Mode

**Entry**: `backend/app/api/subagent.py`

SubAgent mode implements a multi-role collaboration pipeline:

| Role | Function |
|------|----------|
| `planner` | Task decomposition and planning |
| `worker` | General task execution |
| `code_worker` | Code implementation |
| `code_reviewer` | Code quality review |
| `test_engineer` | Test generation |
| `doc_generator` | Documentation authoring |
| `judge` | Quality assessment and gating |

**Collaboration Flow**:

```
Planner -> Worker -> CodeReviewer -> TestEngineer -> Judge
```

**Quality Assessment** (`CodeQualityAssessment`):
- `code_score` - Code quality rating
- `completeness_score` - Task completion
- `test_score` - Test coverage
- `documentation_score` - Doc quality
- `comments` - Review notes
- `approved` - Pass/fail gate

---

## Git Worktree Isolation

**Core**: `backend/app/core/code_isolation_manager.py`

`CodeIsolationManager` creates isolated git worktrees per agent/task, enabling parallel development without branch conflicts.

**Methods**:

| Method | Purpose |
|--------|---------|
| `create_worktree()` | Create isolated branch worktree |
| `get_worktree_path()` | Resolve worktree path |
| `sync_worktree()` | Sync remote changes |
| `commit_worktree_changes()` | Atomic commit |
| `merge_worktree()` | Merge to target branch |
| `remove_worktree()` | Cleanup worktree |
| `cleanup_old_worktrees()` | Prune stale worktrees |

**Safety Validators**:
- `_validate_identifier()` - Sanitize identifiers
- `_validate_branch_name()` - Validate branch names
- `_assert_clean_git_path()` - Ensure clean path state

---

## Task Routing

**Core**: `backend/app/core/task_routing.py`

`TaskRoutingGuard` (policy: `task-execution-routing/v1`) enforces routing decisions at every execution boundary.

**Guard Methods**:

| Method | Purpose |
|--------|---------|
| `route_for_creation()` | Route new tasks |
| `validate_queued_bounded_task()` | Validate queued tasks |
| `authorize_bounded_run()` | Authorize execution |
| `before_model_call()` | Pre-model checks |
| `before_tool_call()` | Pre-tool checks |
| `record_usage()` | Resource accounting |
| `filter_tool_definitions()` | Scope tool access |

**Routing Types**:

| Type | Behavior |
|------|----------|
| `BOUNDED_AGENT` | Read-only sandbox execution |
| `ESCALATE` | Elevated privileges required |

**Hard Signals** (always escalate):
- `requests_command` - Shell command request
- `requests_write` - File write request
- `requests_external_side_effect` - External effects
- `requests_privilege_escalation` - Privilege escalation |

---

## Memory System

**Core**: `backend/app/core/memory_manager.py`

Dual-memory architecture combining session context with long-term vector storage.

### Session Memory

| Field | Type | Purpose |
|-------|------|---------|
| `messages` | `deque` | Rolling message history |
| `context` | `Dict[str, Any]` | Ephemeral context |

**Methods**: `add_message()`, `get_messages()`, `clear()`

### Long-Term Memory

| Component | Technology |
|-----------|------------|
| Vector Store | ChromaDB |
| Collection | `agent_memory` |
| Index Config | `hnsw:space: cosine` |

**Methods**: `add_long_term_memory()`, `search_long_term_memory()`, `get_relevant_context()`

---

## MCP Tools (7 Categories)

1. **model-routing**: `swarm_chat`, `analyze_task`, `stats`, `metrics`, `logs`
2. **workflow**: `execute`, `list`, `validate`, `catalog`, `recommend`
3. **workspace**: file read/write, search, index, analyze
4. **git**: status, commit, branch, MR description
5. **ci**: lint, test, autofix
6. **agents**: list, recommend, create_dynamic, execute_swarm
7. **governance**: list_gates, validate_with_gates
8. **data**: db_stats, vector_search, vector_upsert
9. **skills**: list, execute

---

## Build and Verify Commands

### Backend

```bash
cd /Volumes/code/workspace/agent-cluster/axi-agent/backend
pip install -r requirements.txt
uvicorn app.main:app --reload    # Development server
pytest                            # Unit tests
```

### Frontend

```bash
cd /Volumes/code/workspace/agent-cluster/axi-agent/frontend
pnpm install
pnpm dev                          # Development server
pnpm build                        # Production build
```

### MCP Server

```bash
cd /Volumes/code/workspace/agent-cluster/axi-agent/infra/axi-agent-mcp
pnpm install
pnpm build
pnpm start                        # Production start
```

### Desktop App

```bash
cd /Volumes/code/workspace/agent-cluster/axi-agent/apps/desktop-glass-ui
pnpm install
pnpm dev                          # Development
pnpm build                        # Production build
```

### Docker (Full Stack)

```bash
cd /Volumes/code/workspace/agent-cluster/axi-agent
docker-compose up -d
```

### Workspace Health Check

```bash
/Volumes/code/workspace/scripts/workspace-project health axi-agent
```

---

## Relationship to axiom-workbench

axiom-agent and axiom-workbench are **complementary, non-overlapping systems** with different tech stacks and responsibilities:

| Aspect | axiom-agent | axiom-workbench |
|--------|-------------|-----------------|
| **Primary Role** | Multi-agent orchestration platform | Local development environment |
| **Tech Stack** | Python/FastAPI + TypeScript MCP | (Different stack) |
| **Focus** | Agent collaboration, task routing, memory | Local dev workflow |
| **Entry Points** | API, Web UI, Desktop App | CLI / IDE plugin |

axiom-agent provides the **remote orchestration layer** for multi-agent collaboration, while axiom-workbench handles **local developer workflows**. They integrate at the tool level but maintain distinct boundaries.

---

## File Index

| Component | Key Files |
|-----------|-----------|
| Backend API | `backend/app/api/{agents,tasks,subagent,memory,dashboard,workstation,mcp}.py` |
| Backend Core | `backend/app/core/{code_isolation_manager,task_scheduler,task_routing,swarm_orchestrator,memory_manager,agent_manager}.py` |
| Backend DB | `backend/app/database/{vector_store,models}.py` |
| MCP Server | `infra/axi-agent-mcp/src/{index,tool-contract,model-router,cost-monitor,embedding-client}/` |
| Frontend | `frontend/src/pages/{Chat,Agents,Tasks,Dashboard,SubAgent,Memory}.tsx` |
| Desktop | `apps/desktop-glass-ui/src/App.tsx` |
