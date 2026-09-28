"""File Service API - Entry Point."""
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# PR-6 D4: observability 包路径由环境变量配置，缺省回退到 stdlib logging。
# 默认路径仅在本地开发（foundation/ sibling 存在）时启用。
# CI/容器/CI runner 等无 foundation 的环境会跳过 observability 注入。
_OBSERVABILITY_PYTHON = os.environ.get(
    "AXI_OBSERVABILITY_PYTHON",
    "/Volumes/code/workspace/foundation/axi-observability/python",
)
_observability_setup = None
_observability_path = Path(_OBSERVABILITY_PYTHON)
if _observability_path.is_dir() and str(_observability_path) not in sys.path:
    sys.path.insert(0, str(_observability_path))
    try:
        from axi_observability.logging import setup as _observability_setup  # type: ignore
    except Exception:
        _observability_setup = None

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402

from config import ensure_storage_directory, settings, validate_settings  # noqa: E402
from routers.files import router as files_router, set_file_service  # noqa: E402
from service import build_file_service  # noqa: E402

# Adopt the workspace observability SDK as the root logger when available;
# fall back to stdlib logging when observability SDK is not present.
if _observability_setup is not None:
    logger = _observability_setup(service="axi-file-service", env=settings.environment)
else:
    logger = logging.getLogger(__name__)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_settings()
    if settings.storage_backend.lower() == "local":
        ensure_storage_directory()
    service = await build_file_service(settings)
    set_file_service(service)
    try:
        yield
    finally:
        await service.close()
        set_file_service(None)


app = FastAPI(
    title="File Service API",
    description="API for file upload, download, and management",
    version="1.0.0",
    lifespan=lifespan,
)

# Include routers
app.include_router(files_router)


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "File Service API is running", "docs": "/docs"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )
