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
from storage import LocalStorage, S3Storage, StorageBackend


class FileSizeExceeded(Exception):
    pass


class FileService:
    def __init__(self, settings: Settings, repository: FileRepository, storage: StorageBackend) -> None:
        self.settings = settings
        self.repository = repository
        self.storage = storage

    async def upload(self, subject: str, filename: str, file: UploadFile) -> FileRecord:
        suffix = Path(filename).suffix
        temporary_file = tempfile.NamedTemporaryFile(prefix="axi-upload-", suffix=suffix, delete=False, dir="/tmp")
        temporary_path = Path(temporary_file.name)
        size = 0
        checksum = hashlib.sha256()
        try:
            with temporary_file:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > self.settings.max_file_size:
                        raise FileSizeExceeded
                    checksum.update(chunk)
                    temporary_file.write(chunk)
            content_type = file.content_type or mimetypes.guess_type(filename)[0]
            previous: FileRecord | None = None
            try:
                previous = await self.repository.get(subject, filename)
            except FileNotFound:
                # A first upload has no metadata row. Other repository errors
                # are surfaced by the upsert below instead of being hidden.
                previous = None
            object_key = f"subjects/{_subject_digest(subject)}/{uuid4().hex}-{filename}"
            etag = await self.storage.put(temporary_path, object_key, content_type)
            temporary_path.unlink(missing_ok=True)
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
            )
            try:
                saved = await self.repository.upsert(record)
            except Exception:
                await self.storage.delete(object_key)
                raise
            if previous is not None and previous.object_key != saved.object_key:
                await self.storage.delete(previous.object_key)
            return saved
        finally:
            if temporary_path.name:
                temporary_path.unlink(missing_ok=True)
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

    async def delete(self, subject: str, filename: str) -> FileRecord:
        record = await self.repository.get(subject, filename)
        await self.storage.delete(record.object_key)
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
    return FileService(settings, repository, storage)


def _subject_digest(subject: str) -> str:
    return hashlib.sha256(subject.encode("utf-8")).hexdigest()
