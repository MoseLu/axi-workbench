"""File upload, download and metadata endpoints."""

import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from config import settings
from models.file import DeleteResponse, FileInfo, FileListResponse, FileUploadResponse, HealthResponse, PresignedURLResponse
from repository import FileNotFound
from scanner import MalwareDetected, ScannerUnavailable
from security import require_gateway_identity
from service import FileService, FileSizeExceeded

router = APIRouter(prefix="/files", tags=["files"])
file_service: FileService | None = None


def set_file_service(value: FileService | None) -> None:
    global file_service
    file_service = value


def get_file_service() -> FileService:
    if file_service is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="file service is starting")
    return file_service


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Liveness check that does not require gateway identity."""
    return HealthResponse(
        status="healthy",
        storage_path=str(settings.storage_path),
        max_file_size=settings.max_file_size,
    )


@router.get("/ready")
async def readiness_check() -> dict[str, str]:
    """Readiness includes metadata and object storage availability."""
    service = get_file_service()
    try:
        await service.ping()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="file store unavailable") from exc
    return {"status": "ready", "service": "file-service"}


def _safe_filename(filename: str | None) -> str:
    name = (filename or "").strip()
    if not name or name in {".", ".."} or "/" in name or "\\" in name or "\x00" in name:
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


def _file_info(record) -> FileInfo:
    return FileInfo(
        name=record.name,
        path=record.name,
        size=record.size,
        created_at=record.created_at,
        modified_at=record.modified_at,
        content_type=record.content_type or mimetypes.guess_type(record.name)[0],
        checksum_sha256=record.checksum_sha256,
        thumbnail_available=record.thumbnail_object_key is not None,
        thumbnail_width=record.thumbnail_width,
        thumbnail_height=record.thumbnail_height,
    )


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    subject: str = Depends(require_gateway_identity),
    file: UploadFile = File(...),
) -> FileUploadResponse:
    """Stream one upload through the configured object-storage adapter."""
    filename = _safe_filename(file.filename)
    try:
        record = await get_file_service().upload(subject, filename, file)
    except FileSizeExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.max_file_size} bytes",
        ) from exc
    except MalwareDetected as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="file rejected by malware scanner",
        ) from exc
    except ScannerUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="virus scanner unavailable",
        ) from exc
    return FileUploadResponse(
        name=record.name,
        path=record.name,
        size=record.size,
        checksum_sha256=record.checksum_sha256,
        thumbnail_available=record.thumbnail_object_key is not None,
        thumbnail_width=record.thumbnail_width,
        thumbnail_height=record.thumbnail_height,
        message="File uploaded successfully",
    )


@router.post("/upload/multipart", response_model=list[FileUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_multiple_files(
    subject: str = Depends(require_gateway_identity),
    files: list[UploadFile] = File(...),
) -> list[FileUploadResponse]:
    """Stream multiple uploads, preserving the single-file size limit."""
    responses: list[FileUploadResponse] = []
    for file in files:
        filename = _safe_filename(file.filename)
        try:
            record = await get_file_service().upload(subject, filename, file)
        except FileSizeExceeded as exc:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {settings.max_file_size} bytes",
            ) from exc
        except MalwareDetected as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="file rejected by malware scanner",
            ) from exc
        except ScannerUnavailable as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="virus scanner unavailable",
            ) from exc
        responses.append(
            FileUploadResponse(
                name=record.name,
                path=record.name,
                size=record.size,
                checksum_sha256=record.checksum_sha256,
                thumbnail_available=record.thumbnail_object_key is not None,
                thumbnail_width=record.thumbnail_width,
                thumbnail_height=record.thumbnail_height,
                message="File uploaded successfully",
            )
        )
    return responses


@router.get("/", response_model=FileListResponse)
async def list_files(subject: str = Depends(require_gateway_identity)) -> FileListResponse:
    """List only metadata owned by the verified subject."""
    records = await get_file_service().list(subject)
    return FileListResponse(files=[_file_info(record) for record in records], total=len(records))


@router.get("/download/{filename}")
async def download_file(filename: str, subject: str = Depends(require_gateway_identity)) -> FileResponse:
    """Download through the gateway; object storage keys are never client-controlled."""
    filename = _safe_filename(filename)
    try:
        record, path, temporary = await get_file_service().get_download(subject, filename)
    except (FileNotFound, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File {filename} not found") from exc
    background = BackgroundTask(path.unlink, missing_ok=True) if temporary else None
    return FileResponse(
        path=path,
        filename=record.name,
        media_type=record.content_type or "application/octet-stream",
        background=background,
    )


@router.get("/thumbnail/{filename}")
async def thumbnail_file(filename: str, subject: str = Depends(require_gateway_identity)) -> FileResponse:
    """Serve a generated WebP thumbnail without exposing its object key."""
    filename = _safe_filename(filename)
    try:
        record, path, temporary = await get_file_service().get_thumbnail(subject, filename)
    except (FileNotFound, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Thumbnail for {filename} not found") from exc
    background = BackgroundTask(path.unlink, missing_ok=True) if temporary else None
    return FileResponse(
        path=path,
        filename=f"{record.name}.webp",
        media_type="image/webp",
        background=background,
    )


@router.get("/presigned/{filename}", response_model=PresignedURLResponse)
async def presigned_download_url(
    filename: str,
    subject: str = Depends(require_gateway_identity),
) -> PresignedURLResponse:
    """Return a short-lived S3/MinIO URL without exposing object keys."""
    filename = _safe_filename(filename)
    try:
        url = await get_file_service().get_presigned_download(subject, filename)
    except FileNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File {filename} not found") from exc
    if not url:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="presigned URLs require S3 storage")
    return PresignedURLResponse(url=url, expires_in=settings.presigned_url_ttl_seconds)


@router.delete("/{filename}", response_model=DeleteResponse)
async def delete_file(filename: str, subject: str = Depends(require_gateway_identity)) -> DeleteResponse:
    """Delete the object first, then its owner-scoped metadata row."""
    filename = _safe_filename(filename)
    try:
        record = await get_file_service().delete(subject, filename)
    except (FileNotFound, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File {filename} not found") from exc
    return DeleteResponse(message="File deleted successfully", deleted_file=record.name)
