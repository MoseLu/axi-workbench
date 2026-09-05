"""File metadata and object-storage orchestration."""

from __future__ import annotations

import hashlib
import mimetypes
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from config import Settings
from repository import FileNotFound, FileRecord, FileRepository, MemoryFileRepository, PostgresFileRepository
from scanner import ClamAVScanner, FileScanner, NoopScanner
from storage import LocalStorage, S3Storage, StorageBackend
from thumbnail import NoopThumbnailProcessor, PillowThumbnailProcessor, ThumbnailProcessor


class FileSizeExceeded(Exception):
    pass


class FileService:
    def __init__(
        self,
        settings: Settings,
        repository: FileRepository,
        storage: StorageBackend,
        scanner: FileScanner | None = None,
        thumbnail_processor: ThumbnailProcessor | None = None,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.storage = storage
        self.scanner = scanner or NoopScanner()
        self.thumbnail_processor = thumbnail_processor or (
            PillowThumbnailProcessor(
                settings.thumbnail_max_width,
                settings.thumbnail_max_height,
                settings.thumbnail_quality,
            )
            if settings.thumbnail_enabled
            else NoopThumbnailProcessor()
        )

    async def upload(self, subject: str, filename: str, file: UploadFile) -> FileRecord:
        suffix = Path(filename).suffix
        temporary_file = tempfile.NamedTemporaryFile(prefix="axi-upload-", suffix=suffix, delete=False, dir="/tmp")
        temporary_path = Path(temporary_file.name)
        size = 0
        checksum = hashlib.sha256()
        object_keys_to_clean: list[str] = []
        thumbnail_path: Path | None = None
        persisted = False
        try:
            with temporary_file:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > self.settings.max_file_size:
                        raise FileSizeExceeded
                    checksum.update(chunk)
                    temporary_file.write(chunk)
            await self.scanner.scan(temporary_path)
            content_type = file.content_type or mimetypes.guess_type(filename)[0]
            previous: FileRecord | None = None
            try:
                previous = await self.repository.get(subject, filename)
            except FileNotFound:
                # A first upload has no metadata row. Other repository errors
                # are surfaced by the upsert below instead of being hidden.
                previous = None
            object_key = f"subjects/{_subject_digest(subject)}/{uuid4().hex}-{filename}"
            object_keys_to_clean.append(object_key)
            thumbnail = await self.thumbnail_processor.create(temporary_path, content_type)
            thumbnail_object_key = None
            if thumbnail is not None:
                thumbnail_path = thumbnail.path
                thumbnail_object_key = f"{object_key}.thumb.webp"
                object_keys_to_clean.append(thumbnail_object_key)
            etag = await self.storage.put(temporary_path, object_key, content_type)
            if thumbnail is not None:
                await self.storage.put(thumbnail.path, thumbnail_object_key, thumbnail.content_type)
            now = datetime.now(UTC)
            record = FileRecord(
                id=uuid4(),
                owner_subject=subject,
                name=filename,
                object_key=object_key,
                size=size,
                content_type=content_type,
                etag=etag,
                checksum_sha256=checksum.hexdigest(),
                created_at=now,
                modified_at=now,
                thumbnail_object_key=thumbnail_object_key,
                thumbnail_width=thumbnail.width if thumbnail is not None else None,
                thumbnail_height=thumbnail.height if thumbnail is not None else None,
            )
            saved = await self.repository.upsert(record)
            persisted = True
            if previous is not None and previous.object_key != saved.object_key:
                await self.storage.delete(previous.object_key)
            if previous is not None and previous.thumbnail_object_key:
                if previous.thumbnail_object_key != saved.thumbnail_object_key:
                    await self.storage.delete(previous.thumbnail_object_key)
            return saved
        except Exception:
            if not persisted:
                for object_key_to_clean in reversed(object_keys_to_clean):
                    try:
                        await self.storage.delete(object_key_to_clean)
                    except Exception:
                        pass
            raise
        finally:
            temporary_path.unlink(missing_ok=True)
            if thumbnail_path is not None:
                thumbnail_path.unlink(missing_ok=True)
            await file.close()

    async def list(self, subject: str) -> list[FileRecord]:
        return await self.repository.list(subject)

    async def get_download(self, subject: str, filename: str) -> tuple[FileRecord, Path, bool]:
        record = await self.repository.get(subject, filename)
        try:
            path, temporary = await self.storage.download(record.object_key)
        except FileNotFoundError as exc:
            raise FileNotFoundError(filename) from exc
        return record, path, temporary

    async def get_presigned_download(self, subject: str, filename: str) -> str | None:
        record = await self.repository.get(subject, filename)
        return await self.storage.presigned_url(record.object_key, self.settings.presigned_url_ttl_seconds)

    async def get_thumbnail(self, subject: str, filename: str) -> tuple[FileRecord, Path, bool]:
        record = await self.repository.get(subject, filename)
        if not record.thumbnail_object_key:
            raise FileNotFound
        try:
            path, temporary = await self.storage.download(record.thumbnail_object_key)
        except FileNotFoundError as exc:
            raise FileNotFoundError(filename) from exc
        return record, path, temporary

    async def delete(self, subject: str, filename: str) -> FileRecord:
        record = await self.repository.get(subject, filename)
        await self.storage.delete(record.object_key)
        if record.thumbnail_object_key:
            await self.storage.delete(record.thumbnail_object_key)
        return await self.repository.delete(subject, filename)

    async def ping(self) -> None:
        await self.repository.ping()
        await self.storage.ping()

    async def close(self) -> None:
        await self.repository.close()


async def build_file_service(settings: Settings) -> FileService:
    if settings.database_url:
        repository: FileRepository = await PostgresFileRepository.create(settings.database_url)
    else:
        repository = MemoryFileRepository()

    if settings.storage_backend.lower() == "s3":
        if not settings.s3_bucket or not settings.s3_access_key_id or not settings.s3_secret_access_key:
            await repository.close()
            raise ValueError("S3 bucket and credentials are required for s3 storage")
        storage: StorageBackend = S3Storage(
            endpoint_url=settings.s3_endpoint_url,
            bucket=settings.s3_bucket,
            region=settings.s3_region,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
        )
    else:
        storage = LocalStorage(settings.storage_path)
    scanner = build_scanner(settings)
    thumbnail_processor = build_thumbnail_processor(settings)
    return FileService(settings, repository, storage, scanner, thumbnail_processor)


def build_scanner(settings: Settings) -> FileScanner:
    backend = settings.virus_scan_backend.lower().strip()
    if backend == "clamav":
        return ClamAVScanner(settings.clamav_host, settings.clamav_port, settings.virus_scan_timeout_seconds)
    return NoopScanner()


def build_thumbnail_processor(settings: Settings) -> ThumbnailProcessor:
    if not settings.thumbnail_enabled:
        return NoopThumbnailProcessor()
    return PillowThumbnailProcessor(
        settings.thumbnail_max_width,
        settings.thumbnail_max_height,
        settings.thumbnail_quality,
    )


def _subject_digest(subject: str) -> str:
    return hashlib.sha256(subject.encode("utf-8")).hexdigest()
