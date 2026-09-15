"""Apply file metadata schema migrations."""

import asyncio
import os

from repository import PostgresFileRepository


async def migrate() -> None:
    database_url = os.getenv("FILE_MIGRATION_DATABASE_URL") or os.getenv("FILE_DATABASE_URL")
    if not database_url:
        raise RuntimeError("FILE_MIGRATION_DATABASE_URL or FILE_DATABASE_URL must be set")
    await PostgresFileRepository.apply_migrations(database_url)


if __name__ == "__main__":
    asyncio.run(migrate())
