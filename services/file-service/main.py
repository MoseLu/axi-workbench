"""File Service API - Entry Point."""
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from config import ensure_storage_directory, settings
from routers.files import router as files_router

@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_storage_directory()
    yield


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
