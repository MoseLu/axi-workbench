"""File Service API - Entry Point."""
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Add the foundation observability package to sys.path so this
# service can consume `axi_observability.logging` without making it
# a hard PyPI dependency — the package lives in workspace-level
# `foundation/axi-observability/python/`.
_OBSERVABILITY_PYTHON = Path("/Volumes/code/workspace/foundation/axi-observability/python")
if _OBSERVABILITY_PYTHON.is_dir() and str(_OBSERVABILITY_PYTHON) not in sys.path:
    sys.path.insert(0, str(_OBSERVABILITY_PYTHON))

from axi_observability.logging import setup as _setup_logger  # noqa: E402

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402

from config import ensure_storage_directory, settings, validate_settings  # noqa: E402
from routers.files import router as files_router, set_file_service  # noqa: E402
from service import build_file_service  # noqa: E402

# Adopt the workspace observability SDK as the root logger so all
# downstream `logging.getLogger(__name__)` calls inherit the JSON shape,
# trace_id / request_id injection, and sensitive-field redaction policy.
logger = _setup_logger(service="axi-file-service", env=settings.environment)


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
