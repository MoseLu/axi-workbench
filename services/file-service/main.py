"""File Service API - Entry Point."""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ensure_storage_directory, settings
from routers.files import router as files_router

app = FastAPI(
    title="File Service API",
    description="API for file upload, download, and management",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(files_router)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application on startup."""
    ensure_storage_directory()


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
