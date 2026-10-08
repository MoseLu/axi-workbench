"""Main entry point for the workflow engine service."""

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# PR-6 D4: observability 包路径由环境变量配置，缺省回退到 stdlib logging。
# 默认路径仅在本地开发（foundation/ sibling 存在）时启用。
# 默认值由脚本所在位置向上解析到工作区根，避免硬编码绝对路径。
_FALLBACK_OBSERVABILITY = Path(__file__).resolve().parents[4] / "foundation" / "axi-observability" / "python"
_OBSERVABILITY_PYTHON = os.environ.get(
    "AXI_OBSERVABILITY_PYTHON",
    str(_FALLBACK_OBSERVABILITY),
)
_observability_path = Path(_OBSERVABILITY_PYTHON)
if _observability_path.is_dir() and str(_observability_path) not in sys.path:
    sys.path.insert(0, str(_observability_path))

from fastapi import FastAPI, HTTPException, status

from config import get_settings
from routers.workflows import (
    get_executor,
    get_repository,
    router as workflows_router,
    set_repository,
)
from routers.events import router as events_router
from services.dispatch_worker import WorkflowDispatchWorker
from services.repository import MemoryWorkflowRepository, PostgresWorkflowRepository

# Configure logging via the workspace SDK when available — basicConfig is
# replaced so trace_id / request_id get attached automatically to every record.
# Falls back to stdlib logging when observability SDK is not present.
logger = logging.getLogger(__name__)
_axilog_setup = None
try:
    from axi_observability.logging import setup as _axilog_setup  # type: ignore
    _axilog_setup(service="axi-workflow-engine")
except Exception:
    # Keep the conventional stdlib root logger so installs without the
    # foundation workspace still produce records.
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    runtime_repository = None
    worker_task: asyncio.Task[None] | None = None
    stop_event = asyncio.Event()
    if settings.database_url:
        runtime_repository = await PostgresWorkflowRepository.connect(settings.database_url)
        recovered = await runtime_repository.recover_interrupted()
        if recovered:
            logger.warning("Marked %d interrupted workflow executions as failed", recovered)
        set_repository(runtime_repository)
        worker = WorkflowDispatchWorker(
            runtime_repository,
            get_executor(),
            max_concurrency=settings.max_concurrent_workflows,
            lease_seconds=settings.dispatch_lease_seconds,
            poll_interval_seconds=settings.dispatch_poll_interval_seconds,
            max_attempts=settings.max_dispatch_attempts,
            retry_base_seconds=settings.dispatch_retry_base_seconds,
            retry_max_seconds=settings.dispatch_retry_max_seconds,
        )
        worker_task = asyncio.create_task(worker.run(stop_event), name="workflow-dispatch-worker")
    elif settings.environment.lower() == "production":
        raise RuntimeError("WORKFLOW_DATABASE_URL must be injected in production")
    else:
        logger.warning("Workflow engine is using the development memory repository")

    try:
        yield
    finally:
        stop_event.set()
        if worker_task is not None:
            await worker_task
        if runtime_repository is not None:
            await runtime_repository.close()
        set_repository(MemoryWorkflowRepository())
        logger.info("Shutting down workflow engine")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Enterprise workflow automation engine",
    lifespan=lifespan,
)

# Include routers
app.include_router(workflows_router)
app.include_router(events_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/ready")
async def readiness_check():
    """Readiness includes the durable workflow schema when configured."""
    try:
        await get_repository().ping()
    except Exception as exc:
        logger.warning("Workflow engine is not ready: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="workflow store unavailable") from exc
    return {"status": "ready", "service": settings.app_name}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
