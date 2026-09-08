"""File Service API - Entry Point."""
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from config import ensure_storage_directory, settings, validate_settings
from routers.files import router as files_router, set_file_service
from service import build_file_service

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
