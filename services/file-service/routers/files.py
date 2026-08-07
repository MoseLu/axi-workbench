"""File upload/download endpoints."""
import hashlib
import mimetypes
import os
from pathlib import Path
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from config import settings
from models.file import (
    DeleteResponse,
    FileInfo,
    FileListResponse,
    FileUploadResponse,
    HealthResponse,
)
from security import require_gateway_identity

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        storage_path=str(settings.storage_path),
        max_file_size=settings.max_file_size,
    )


def _subject_storage_path(subject: str) -> Path:
    """Use a stable opaque directory so one subject cannot address another."""

    digest = hashlib.sha256(subject.encode("utf-8")).hexdigest()
    path = settings.storage_path / "subjects" / digest
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_filename(filename: str | None) -> str:
    name = (filename or "").strip()
    if not name or name in {".", ".."} or "/" in name or "\\" in name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="a single safe filename is required",
        )
    if settings.allowed_extensions != ["*"]:
        extension = Path(name).suffix.lower().lstrip(".")
        if extension not in {item.lower().lstrip(".") for item in settings.allowed_extensions}:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="file extension is not allowed",
            )
    return name


def _subject_file_path(subject: str, filename: str | None) -> Path:
    root = _subject_storage_path(subject).resolve()
    path = (root / _safe_filename(filename)).resolve()
    if path.parent != root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid file path",
        )
    return path


async def _save_upload(subject: str, file: UploadFile) -> tuple[str, Path, int]:
    filename = _safe_filename(file.filename)
    target = _subject_file_path(subject, filename)
    temporary = target.parent / f".{uuid4().hex}.upload"
    size = 0
    try:
        with temporary.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_file_size:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File size exceeds maximum allowed size of {settings.max_file_size} bytes",
                    )
                output.write(chunk)
        os.replace(temporary, target)
    except HTTPException:
        temporary.unlink(missing_ok=True)
        raise
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return filename, target, size


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    subject: str = Depends(require_gateway_identity),
    file: UploadFile = File(...),
) -> FileUploadResponse:
    """Upload a single file."""
    filename, _, file_size = await _save_upload(subject, file)

    return FileUploadResponse(
        name=filename,
        path=filename,
        size=file_size,
        message="File uploaded successfully",
    )


@router.post("/upload/multipart", response_model=list[FileUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_multiple_files(
    subject: str = Depends(require_gateway_identity),
    files: list[UploadFile] = File(...),
) -> list[FileUploadResponse]:
    """Upload multiple files."""
    responses = []

    for file in files:
        filename, _, file_size = await _save_upload(subject, file)

        responses.append(
            FileUploadResponse(
                name=filename,
                path=filename,
                size=file_size,
                message="File uploaded successfully",
            )
        )

    return responses


@router.get("/", response_model=FileListResponse)
async def list_files(subject: str = Depends(require_gateway_identity)) -> FileListResponse:
    """List all files in storage."""
    storage_path = _subject_storage_path(subject)

    files = []
    for file_path in storage_path.iterdir():
        if file_path.is_file():
            stat = file_path.stat()
            content_type, _ = mimetypes.guess_type(str(file_path))
            files.append(
                FileInfo(
                    name=file_path.name,
                    path=str(file_path.relative_to(storage_path)),
                    size=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_ctime),
                    modified_at=datetime.fromtimestamp(stat.st_mtime),
                    content_type=content_type,
                )
            )

    return FileListResponse(files=files, total=len(files))


@router.get("/download/{filename}")
async def download_file(filename: str, subject: str = Depends(require_gateway_identity)) -> FileResponse:
    """Download a file."""
    file_path = _subject_file_path(subject, filename)

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
async def delete_file(filename: str, subject: str = Depends(require_gateway_identity)) -> DeleteResponse:
    """Delete a file."""
    file_path = _subject_file_path(subject, filename)

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
