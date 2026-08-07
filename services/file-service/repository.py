"""Metadata repositories for files stored in local or S3-compatible storage."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import tuple_row
from psycopg_pool import AsyncConnectionPool


@dataclass(slots=True)
class FileRecord:
    id: UUID
    owner_subject: str
    name: str
    object_key: str
    size: int
    content_type: str | None
    etag: str | None
    created_at: datetime
    modified_at: datetime


class FileNotFound(Exception):
    """The file is absent or belongs to another subject."""


class FileRepository(ABC):
    @abstractmethod
    async def upsert(self, record: FileRecord) -> FileRecord:
        raise NotImplementedError

    @abstractmethod
    async def list(self, subject: str) -> list[FileRecord]:
        raise NotImplementedError

    @abstractmethod
    async def get(self, subject: str, name: str) -> FileRecord:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, subject: str, name: str) -> FileRecord:
        raise NotImplementedError

    @abstractmethod
    async def ping(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def close(self) -> None:
        raise NotImplementedError


class MemoryFileRepository(FileRepository):
    """Development-only metadata repository."""

    def __init__(self) -> None:
        self.files: dict[tuple[str, str], FileRecord] = {}
        self._lock = asyncio.Lock()

    async def upsert(self, record: FileRecord) -> FileRecord:
        async with self._lock:
            existing = self.files.get((record.owner_subject, record.name))
            if existing is not None:
                record.created_at = existing.created_at
            self.files[(record.owner_subject, record.name)] = record
            return record

    async def list(self, subject: str) -> list[FileRecord]:
        async with self._lock:
            return sorted(
                [record for (owner, _), record in self.files.items() if owner == subject],
                key=lambda record: (record.modified_at, record.name),
                reverse=True,
            )

    async def get(self, subject: str, name: str) -> FileRecord:
        async with self._lock:
            record = self.files.get((subject, name))
            if record is None:
                raise FileNotFound
            return record

    async def delete(self, subject: str, name: str) -> FileRecord:
        async with self._lock:
            record = self.files.pop((subject, name), None)
            if record is None:
                raise FileNotFound
            return record

    async def ping(self) -> None:
        return None

    async def close(self) -> None:
        return None


class PostgresFileRepository(FileRepository):
    """PostgreSQL metadata repository with owner-scoped SQL predicates."""

    _migration_path = Path(__file__).resolve().parent / "migrations" / "001_files.sql"

    def __init__(self, pool: AsyncConnectionPool[Any]) -> None:
        self.pool = pool

    @classmethod
    async def create(cls, database_url: str) -> PostgresFileRepository:
        pool: AsyncConnectionPool[Any] = AsyncConnectionPool(
            conninfo=database_url,
            min_size=1,
            max_size=10,
            open=False,
            kwargs={"row_factory": tuple_row},
        )
        await pool.open(wait=True)
        return cls(pool)

    @classmethod
    async def apply_migrations(cls, database_url: str) -> None:
        migration = cls._migration_path.read_text(encoding="utf-8")
        connection = await AsyncConnection.connect(database_url, row_factory=tuple_row)
        try:
            await connection.execute(migration)
            await connection.commit()
        finally:
            await connection.close()

    async def upsert(self, record: FileRecord) -> FileRecord:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    INSERT INTO axi_files.files
                        (id, owner_subject, name, object_key, size_bytes, content_type,
                         etag, created_at, modified_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (owner_subject, name) DO UPDATE SET
                        object_key = EXCLUDED.object_key,
                        size_bytes = EXCLUDED.size_bytes,
                        content_type = EXCLUDED.content_type,
                        etag = EXCLUDED.etag,
                        modified_at = EXCLUDED.modified_at
                    RETURNING id, owner_subject, name, object_key, size_bytes,
                              content_type, etag, created_at, modified_at
                    """,
                    (
                        record.id,
                        record.owner_subject,
                        record.name,
                        record.object_key,
                        record.size,
                        record.content_type,
                        record.etag,
                        record.created_at,
                        record.modified_at,
                    ),
                )
                row = await cursor.fetchone()
            await connection.commit()
        assert row is not None
        return _record_from_row(row)

    async def list(self, subject: str) -> list[FileRecord]:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT id, owner_subject, name, object_key, size_bytes,
                           content_type, etag, created_at, modified_at
                    FROM axi_files.files
                    WHERE owner_subject = %s
                    ORDER BY modified_at DESC, name
                    """,
                    (subject,),
                )
                rows = await cursor.fetchall()
        return [_record_from_row(row) for row in rows]

    async def get(self, subject: str, name: str) -> FileRecord:
        row = await self._fetch_one(
            """
            SELECT id, owner_subject, name, object_key, size_bytes,
                   content_type, etag, created_at, modified_at
            FROM axi_files.files
            WHERE owner_subject = %s AND name = %s
            """,
            (subject, name),
        )
        if row is None:
            raise FileNotFound
        return _record_from_row(row)

    async def delete(self, subject: str, name: str) -> FileRecord:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    DELETE FROM axi_files.files
                    WHERE owner_subject = %s AND name = %s
                    RETURNING id, owner_subject, name, object_key, size_bytes,
                              content_type, etag, created_at, modified_at
                    """,
                    (subject, name),
                )
                row = await cursor.fetchone()
                if row is None:
                    raise FileNotFound
            await connection.commit()
        return _record_from_row(row)

    async def ping(self) -> None:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'axi_files' AND table_name = 'files'
                    """
                )
                if await cursor.fetchone() is None:
                    raise RuntimeError("file metadata schema has not been migrated")

    async def close(self) -> None:
        await self.pool.close()

    async def _fetch_one(self, query: str, params: tuple[Any, ...]) -> tuple[Any, ...] | None:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(query, params)
                return await cursor.fetchone()


def _record_from_row(row: tuple[Any, ...]) -> FileRecord:
    return FileRecord(
        id=row[0],
        owner_subject=row[1],
        name=row[2],
        object_key=row[3],
        size=row[4],
        content_type=row[5],
        etag=row[6],
        created_at=row[7],
        modified_at=row[8],
    )
