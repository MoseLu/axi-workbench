"""
Mini-Agent Local Server

FastAPI-based HTTP/WebSocket server for Mini-Agent Desktop.
Provides API endpoints for AI chat, session management, and terminal access.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
import uuid
from pathlib import Path
from typing import Dict, Optional
from dataclasses import asdict
from datetime import datetime
from pydantic import BaseModel

# Import Mini-Agent core components
from mini_agent.agent import Agent, StreamChunk, StreamChunkType
from mini_agent.llm import LLMClient
from mini_agent.tools.file_tools import ReadTool, WriteTool, EditTool
from mini_agent.tools.bash_tool import BashTool, BashOutputTool, BashKillTool, BackgroundShellManager
from mini_agent.tools.base import Tool
from mini_agent.config import Config
from mini_agent.retry import RetryConfig as RetryConfigBase

# Try to import skill loader (optional)
try:
    from mini_agent.tools.skill_loader import SkillLoader
    SKILL_LOADER_AVAILABLE = True
except ImportError:
    SKILL_LOADER_AVAILABLE = False

# Import performance monitoring
from local_server.performance import (
    performance_monitor,
    setup_error_handlers,
    PerformanceMetrics,
    ErrorRecord,
)

# Import logging
from local_server.logger import setup_logger, log_request, log_response

# Setup logger
logger = setup_logger("mini-agent-server")


# ============================================================================
# Data Models
# ============================================================================

class CreateSessionRequest(BaseModel):
    """Request to create a new session."""
    workspace_dir: str = "."
    system_prompt: Optional[str] = None
    max_steps: int = 50


class ChatRequest(BaseModel):
    """Request to send a chat message."""
    message: str
    stream: bool = True


class ChatMessage(BaseModel):
    """A chat message in history."""
    role: str
    content: str
    thinking: Optional[str] = None
    tool_calls: Optional[list] = None


class SessionInfo(BaseModel):
    """Session information."""
    id: str
    workspace_dir: str
    created_at: datetime
    message_count: int


class ExecuteRequest(BaseModel):
    """Request to execute a terminal command."""
    command: str


class ExecuteResponse(BaseModel):
    """Response from command execution."""
    output: str
    error: Optional[str] = None
    exit_code: int = 0


# ============================================================================
# Session Manager
# ============================================================================

class SessionManager:
    """Manages multiple agent sessions."""

    def __init__(self):
        self.sessions: Dict[str, Dict] = {}
        self._config = Config.load()
        self._base_tools: list[Tool] = []

    def _create_llm_client(self) -> LLMClient:
        """Create LLM client from config."""
        return LLMClient(
            api_key=self._config.llm.api_key,
            api_base=self._config.llm.api_base,
            model=self._config.llm.model,
            retry_config=RetryConfigBase(
                enabled=self._config.llm.retry.enabled,
                max_retries=self._config.llm.retry.max_retries,
                initial_delay=self._config.llm.retry.initial_delay,
                max_delay=self._config.llm.retry.max_delay,
                exponential_base=self._config.llm.retry.exponential_base,
            ),
        )

    def _create_tools(self, workspace_dir: str) -> list[Tool]:
        """Create tools for a session."""
        tools = []

        # File tools
        tools.append(ReadTool(workspace_dir))
        tools.append(WriteTool(workspace_dir))
        tools.append(EditTool(workspace_dir))

        # Bash tools
        tools.append(BashTool(workspace_dir))
        tools.append(BashOutputTool())
        tools.append(BashKillTool())

        return tools

    def _load_skills(self) -> str:
        """Load skills and return system prompt addition."""
        try:
            skill_loader = load_skills(self._config)
            if skill_loader:
                meta = skill_loader.get_skills_metadata_prompt()
                return meta or ""
        except Exception:
            pass
        return ""

    async def initialize(self):
        """Initialize base tools."""
        self._base_tools = self._create_tools(".")

        # Try to load MCP servers
        try:
            from mini_agent.tools.mcp_loader import MCPToolLoader
            mcp_config_path = self._config.agent.mcp_config_path
            if mcp_config_path and Path(mcp_config_path).exists():
                mcp_loader = MCPToolLoader(mcp_config_path)
                mcp_tools = await mcp_loader.load_tools()
                self._base_tools.extend(mcp_tools)
        except Exception:
            pass  # MCP is optional

    def create_session(self, workspace_dir: str = ".", system_prompt: Optional[str] = None, max_steps: int = 50) -> str:
        """Create a new session and return session ID."""
        session_id = f"sess-{uuid.uuid4().hex[:8]}"

        # Resolve workspace path
        workspace = Path(workspace_dir).expanduser()
        if not workspace.is_absolute():
            workspace = workspace.resolve()

        # Create tools for this workspace
        tools = self._create_tools(str(workspace))

        # Load system prompt
        if system_prompt is None:
            prompt_path = Config.find_config_file(self._config.agent.system_prompt_path)
            if prompt_path and prompt_path.exists():
                system_prompt = prompt_path.read_text(encoding="utf-8")
            else:
                system_prompt = "You are a helpful AI assistant."

        # Add skills metadata to system prompt
        skills_meta = self._load_skills()
        if skills_meta:
            system_prompt = f"{system_prompt.rstrip()}\n\n{skills_meta}"

        # Create agent
        agent = Agent(
            llm_client=self._create_llm_client(),
            system_prompt=system_prompt,
            tools=tools,
            max_steps=max_steps,
            workspace_dir=str(workspace),
        )

        # Store session
        self.sessions[session_id] = {
            "agent": agent,
            "workspace_dir": str(workspace),
            "created_at": datetime.now(),
            "max_steps": max_steps,
        }

        return session_id

    def get_session(self, session_id: str) -> Optional[Agent]:
        """Get agent for a session."""
        session = self.sessions.get(session_id)
        return session["agent"] if session else None

    def get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Get session info."""
        session = self.sessions.get(session_id)
        if not session:
            return None

        return SessionInfo(
            id=session_id,
            workspace_dir=session["workspace_dir"],
            created_at=session["created_at"],
            message_count=len(session["agent"].messages),
        )

    def list_sessions(self) -> list[SessionInfo]:
        """List all sessions."""
        return [
            self.get_session_info(sid)
            for sid in self.sessions.keys()
        ]

    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False


# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="Mini-Agent Desktop API",
    description="Local API server for Mini-Agent Desktop",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session manager (initialized on startup)
session_manager: SessionManager = SessionManager()


@app.on_event("startup")
async def startup_event():
    """Initialize session manager on startup."""
    await session_manager.initialize()


# ============================================================================
# API Routes
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Mini-Agent Desktop API",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# Session Management
# ---------------------------------------------------------------------------

@app.post("/api/sessions", response_model=dict)
async def create_session(request: CreateSessionRequest):
    """Create a new session."""
    session_id = session_manager.create_session(
        workspace_dir=request.workspace_dir,
        system_prompt=request.system_prompt,
        max_steps=request.max_steps,
    )
    return {"session_id": session_id}


@app.get("/api/sessions")
async def list_sessions():
    """List all sessions."""
    sessions = session_manager.list_sessions()
    return {"sessions": [s.model_dump() for s in sessions]}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session info."""
    info = session_manager.get_session_info(session_id)
    if not info:
        raise HTTPException(status_code=404, detail="Session not found")
    return info.model_dump()


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    if not session_manager.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/chat")
async def chat(session_id: str, request: ChatRequest):
    """Send a chat message (non-streaming)."""
    agent = session_manager.get_session(session_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Session not found")

    # Add user message
    agent.add_user_message(request.message)

    # Run agent and collect all output
    full_content = ""
    full_thinking = ""

    async for chunk in agent.run_stream():
        if chunk.type == StreamChunkType.THINKING:
            full_thinking = chunk.thinking or ""
        elif chunk.type == StreamChunkType.CONTENT:
            full_content = chunk.content or ""
        elif chunk.type == StreamChunkType.COMPLETE:
            full_content = chunk.content or ""
        elif chunk.type == StreamChunkType.ERROR:
            return {
                "error": chunk.error,
                "content": full_content,
                "thinking": full_thinking,
            }

    return {
        "content": full_content,
        "thinking": full_thinking,
    }


@app.get("/api/sessions/{session_id}/history")
async def get_history(session_id: str):
    """Get chat history for a session."""
    agent = session_manager.get_session(session_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = []
    for msg in agent.messages:
        messages.append({
            "role": msg.role,
            "content": msg.content if isinstance(msg.content, str) else str(msg.content),
            "thinking": msg.thinking,
        })

    return {"messages": messages}


@app.post("/api/sessions/{session_id}/cancel")
async def cancel_session(session_id: str):
    """Cancel a running session."""
    agent = session_manager.get_session(session_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Session not found")

    # Set cancel event if exists
    if agent.cancel_event is not None:
        agent.cancel_event.set()

    return {"status": "cancelled"}


class ConfigResponse(BaseModel):
    """Configuration response."""
    llm_model: str
    llm_api_base: Optional[str]
    max_steps: int
    workspace_dir: str
    mcp_servers: list[str]


# ============================================================================
# File System Operations
# ============================================================================

class FileNode(BaseModel):
    """A file or directory node."""
    name: str
    path: str
    is_directory: bool
    children: Optional[list["FileNode"]] = None


@app.get("/api/workspaces/{workspace_id}/files", response_model=list[FileNode])
async def list_files(workspace_id: str, path: str = "."):
    """List files in workspace directory."""
    session = session_manager.sessions.get(workspace_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace_path = Path(session["workspace_dir"])
    if not path or path == ".":
        target_path = workspace_path
    else:
        target_path = workspace_path / path
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        if not target_path.is_relative_to(workspace_path):
            raise HTTPException(status_code=403, detail="Access denied")

    if not target_path.is_dir():
        return [FileNode(
            name=target_path.name,
            path=str(target_path.relative_to(workspace_path)),
            is_directory=False,
        )]

    # Build file tree
    files = []
    try:
        for item in sorted(target_path.iterdir(), key=lambda x: (not x.is_dir(), x.name)):
            if item.name.startswith('.'):
                continue  # Skip hidden files

            rel_path = str(item.relative_to(workspace_path))
            files.append(FileNode(
                name=item.name,
                path=rel_path,
                is_directory=item.is_dir(),
            ))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return files


@app.get("/api/workspaces/{workspace_id}/files/read", response_model=dict)
async def read_file(workspace_id: str, path: str):
    """Read file content."""
    session = session_manager.sessions.get(workspace_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace_path = Path(session["workspace_dir"])
    file_path = workspace_path / path

    # Security check
    try:
        resolved = file_path.resolve()
        if not resolved.is_relative_to(workspace_path.resolve()):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid path")

    if not resolved.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        content = resolved.read_text(encoding="utf-8")
        return {"content": content, "path": path}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read file: {str(e)}")


class WriteFileRequest(BaseModel):
    """Request to write a file."""
    path: str
    content: str


@app.post("/api/workspaces/{workspace_id}/files/write")
async def write_file(workspace_id: str, request: WriteFileRequest):
    """Write file content."""
    session = session_manager.sessions.get(workspace_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace_path = Path(session["workspace_dir"])
    file_path = workspace_path / request.path

    # Security check
    try:
        resolved = file_path.resolve()
        if not resolved.is_relative_to(workspace_path.resolve()):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid path")

    try:
        # Create parent directories if needed
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(request.content, encoding="utf-8")
        return {"status": "saved", "path": request.path}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot write file: {str(e)}")


# ============================================================================
# Terminal Execution
# ============================================================================

@app.post("/api/sessions/{session_id}/execute", response_model=ExecuteResponse)
async def execute_command(session_id: str, request: ExecuteRequest):
    """Execute a terminal command in the session's workspace."""
    session = session_manager.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace_dir = session["workspace_dir"]
    bash_tool = BashTool(workspace_dir)

    try:
        result = await bash_tool.execute(request.command, timeout=60)
        return ExecuteResponse(
            output=result.content or "",
            error=result.error,
            exit_code=0 if result.success else 1,
        )
    except Exception as e:
        return ExecuteResponse(
            output="",
            error=str(e),
            exit_code=1,
        )


# ---------------------------------------------------------------------------
# Chat WebSocket for Streaming
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for streaming chat."""
    await websocket.accept()

    current_session_id: Optional[str] = None

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            msg_type = message.get("type", "chat")

            if msg_type == "chat":
                session_id = message.get("session_id")
                user_message = message.get("message", "")

                if not session_id:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Missing session_id",
                    })
                    continue

                agent = session_manager.get_session(session_id)
                if not agent:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Session not found",
                    })
                    continue

                # Add user message
                agent.add_user_message(user_message)

                # Stream agent output
                async for chunk in agent.run_stream():
                    chunk_data = {
                        "type": "chunk",
                    }

                    if chunk.type == StreamChunkType.THINKING:
                        chunk_data["thinking"] = chunk.thinking
                    elif chunk.type == StreamChunkType.TOOL_CALL:
                        chunk_data["type"] = "tool_call"
                        chunk_data["tool_name"] = chunk.tool_name
                        chunk_data["tool_call_id"] = chunk.tool_call_id
                        chunk_data["tool_args"] = chunk.tool_args
                    elif chunk.type == StreamChunkType.TOOL_RESULT:
                        chunk_data["type"] = "tool_result"
                        chunk_data["tool_name"] = chunk.tool_name
                        chunk_data["tool_call_id"] = chunk.tool_call_id
                        chunk_data["tool_result"] = chunk.tool_result
                        chunk_data["tool_success"] = chunk.tool_success
                    elif chunk.type == StreamChunkType.CONTENT:
                        chunk_data["content"] = chunk.content
                    elif chunk.type == StreamChunkType.COMPLETE:
                        chunk_data["content"] = chunk.content
                        chunk_data["type"] = "done"
                    elif chunk.type == StreamChunkType.ERROR:
                        chunk_data["type"] = "error"
                        chunk_data["error"] = chunk.error

                    await websocket.send_json(chunk_data)

            elif msg_type == "cancel":
                session_id = message.get("session_id")
                if session_id:
                    agent = session_manager.get_session(session_id)
                    if agent and agent.cancel_event is not None:
                        agent.cancel_event.set()
                        await websocket.send_json({"type": "cancelled"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "error": str(e),
            })
        except:
            pass
# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@app.get("/api/config")
async def get_config():
    """Get current configuration."""
    config = Config.load()
    return ConfigResponse(
        llm_model=config.llm.model,
        llm_api_base=config.llm.api_base,
        max_steps=config.agent.max_steps,
        workspace_dir=config.agent.workspace_dir,
        mcp_servers=[],
    )


# ---------------------------------------------------------------------------
# Terminal (WebSocket)
# ---------------------------------------------------------------------------

@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    """WebSocket terminal for command execution."""
    await websocket.accept()

    # This is a simplified terminal - in production you'd want a full PTY
    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data).get("command", "")

            if not command:
                continue

            # Execute command using BashTool
            bash_tool = BashTool()

            try:
                result = await bash_tool.execute(command, timeout=30)
                await websocket.send_json({
                    "success": result.success,
                    "output": result.content,
                    "error": result.error,
                })
            except Exception as e:
                await websocket.send_json({
                    "success": False,
                    "error": str(e),
                })

    except WebSocketDisconnect:
        pass


# ============================================================================
# Performance Monitoring & Diagnostics
# ============================================================================

@app.get("/api/metrics", response_model=dict)
async def get_metrics():
    """Get current performance metrics."""
    metrics = performance_monitor.get_metrics(
        active_sessions=len(session_manager.sessions)
    )
    return asdict(metrics)


@app.get("/api/metrics/errors", response_model=dict)
async def get_errors(limit: int = 20):
    """Get recent errors."""
    errors = performance_monitor.get_errors(limit)
    return {"errors": errors}


@app.get("/api/metrics/uptime", response_model=dict)
async def get_uptime():
    """Get application uptime."""
    return {
        "uptime_seconds": performance_monitor.get_uptime(),
    }


@app.post("/api/metrics/reset")
async def reset_metrics():
    """Reset performance statistics."""
    performance_monitor.reset_stats()
    return {"status": "reset"}


# Setup error handlers
app = setup_error_handlers(app)


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "local_server:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
    )
