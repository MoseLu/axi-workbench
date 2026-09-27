"""Local and S3-compatible object storage adapters."""

from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path

import boto3


class StorageBackend(ABC):
    @abstractmethod
    async def put(self, temporary_path: Path, object_key: str, content_type: str | None) -> str | None:
        raise NotImplementedError

    @abstractmethod
    async def download(self, object_key: str) -> tuple[Path, bool]:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, object_key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def presigned_url(self, object_key: str, expires_in: int) -> str | None:
        raise NotImplementedError

    @abstractmethod
    async def ping(self) -> None:
        raise NotImplementedError


class LocalStorage(StorageBackend):
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, object_key: str) -> Path:
        path = (self.root / object_key).resolve()
        if path != self.root and self.root not in path.parents:
            raise ValueError("object key escapes local storage root")
        return path

    async def put(self, temporary_path: Path, object_key: str, content_type: str | None) -> str | None:
        target = self._path(object_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        staging = target.parent / f".{target.name}.upload"
        try:
            await asyncio.to_thread(shutil.copyfile, temporary_path, staging)
            await asyncio.to_thread(os.replace, staging, target)
        finally:
            staging.unlink(missing_ok=True)
        return None

    async def download(self, object_key: str) -> tuple[Path, bool]:
        path = self._path(object_key)
        if not path.is_file():
            raise FileNotFoundError(object_key)
        return path, False

    async def delete(self, object_key: str) -> None:
        self._path(object_key).unlink(missing_ok=True)

    async def presigned_url(self, object_key: str, expires_in: int) -> str | None:
        return None

    async def ping(self) -> None:
        if not self.root.is_dir():
            raise RuntimeError("local storage directory is unavailable")


class S3Storage(StorageBackend):
    def __init__(
        self,
        *,
        endpoint_url: str | None,
        bucket: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
    ) -> None:
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    async def put(self, temporary_path: Path, object_key: str, content_type: str | None) -> str | None:
        extra_args = {"ContentType": content_type or "application/octet-stream"}
        await asyncio.to_thread(self.client.upload_file, str(temporary_path), self.bucket, object_key, ExtraArgs=extra_args)
        metadata = await asyncio.to_thread(self.client.head_object, Bucket=self.bucket, Key=object_key)
        return str(metadata.get("ETag", "")).strip('"') or None

    async def download(self, object_key: str) -> tuple[Path, bool]:
        handle, name = tempfile.mkstemp(prefix="axi-file-")
        os.close(handle)
        path = Path(name)
        try:
            await asyncio.to_thread(self.client.download_file, self.bucket, object_key, str(path))
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return path, True

    async def delete(self, object_key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=object_key)

    async def presigned_url(self, object_key: str, expires_in: int) -> str | None:
        return await asyncio.to_thread(
            self.client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )

    async def ping(self) -> None:
        await asyncio.to_thread(self.client.head_bucket, Bucket=self.bucket)
