"""Apply workflow schema migrations using the dedicated migration DSN."""

import asyncio
import os

from services.repository import PostgresWorkflowRepository


async def migrate() -> None:
    database_url = os.getenv("WORKFLOW_MIGRATION_DATABASE_URL") or os.getenv("WORKFLOW_DATABASE_URL")
    if not database_url:
        raise RuntimeError("WORKFLOW_MIGRATION_DATABASE_URL or WORKFLOW_DATABASE_URL must be set")
    await PostgresWorkflowRepository.apply_migrations(database_url)


if __name__ == "__main__":
    asyncio.run(migrate())
