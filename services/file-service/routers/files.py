"""File upload/download endpoints."""
import mimetypes
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from config import ensure_storage_directory, settings
from models.file import (
    DeleteResponse,
    FileInfo,
    FileListResponse,
    FileUploadResponse,
    HealthResponse,
)

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        storage_path=str(settings.storage_path),
        max_file_size=settings.max_file_size,
    )


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...)) -> FileUploadResponse:
    """Upload a single file."""
    ensure_storage_directory()

    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.max_file_size} bytes",
        )

    # Save file
    file_path = settings.storage_path / file.filename
    content = await file.read()
    file_path.write_bytes(content)

    return FileUploadResponse(
        name=file.filename,
        path=str(file_path.relative_to(settings.storage_path)),
        size=file_size,
        message="File uploaded successfully",
    )


@router.post("/upload/multipart", response_model=list[FileUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_multiple_files(files: list[UploadFile] = File(...)) -> list[FileUploadResponse]:
    """Upload multiple files."""
    ensure_storage_directory()
    responses = []

    for file in files:
        # Check file size
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        if file_size > settings.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds maximum allowed size of {settings.max_file_size} bytes",
            )

        # Save file
        file_path = settings.storage_path / file.filename
        content = await file.read()
        file_path.write_bytes(content)

        responses.append(
            FileUploadResponse(
                name=file.filename,
                path=str(file_path.relative_to(settings.storage_path)),
                size=file_size,
                message="File uploaded successfully",
            )
        )

    return responses


@router.get("/", response_model=FileListResponse)
async def list_files() -> FileListResponse:
    """List all files in storage."""
    ensure_storage_directory()

    files = []
    for file_path in settings.storage_path.iterdir():
        if file_path.is_file():
            stat = file_path.stat()
            content_type, _ = mimetypes.guess_type(str(file_path))
            files.append(
                FileInfo(
                    name=file_path.name,
                    path=str(file_path.relative_to(settings.storage_path)),
                    size=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_ctime),
                    modified_at=datetime.fromtimestamp(stat.st_mtime),
                    content_type=content_type,
                )
            )

    return FileListResponse(files=files, total=len(files))


@router.get("/download/{filename}")
async def download_file(filename: str) -> FileResponse:
    """Download a file."""
    file_path = settings.storage_path / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {filename} not found",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{filename} is not a file",
        )

    content_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=content_type or "application/octet-stream",
    )


@router.delete("/{filename}", response_model=DeleteResponse)
async def delete_file(filename: str) -> DeleteResponse:
    """Delete a file."""
    file_path = settings.storage_path / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {filename} not found",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{filename} is not a file",
        )

    file_path.unlink()

    return DeleteResponse(
        message="File deleted successfully",
        deleted_file=filename,
    )
