"""Durable and development repositories for workflow state."""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import tuple_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from models.workflow import Workflow, WorkflowExecution, WorkflowStatus


class WorkflowNotFound(Exception):
    """The workflow is absent or owned by another subject."""


class WorkflowAlreadyRunning(Exception):
    """The workflow has already been claimed by another execution."""


class WorkflowRepository(ABC):
    @abstractmethod
    async def list(self, subject: str) -> list[Workflow]:
        raise NotImplementedError

    @abstractmethod
    async def create(self, workflow: Workflow) -> Workflow:
        raise NotImplementedError

    @abstractmethod
    async def get(self, workflow_id: UUID, subject: str) -> Workflow:
        raise NotImplementedError

    @abstractmethod
    async def update(self, workflow: Workflow, subject: str) -> Workflow:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, workflow_id: UUID, subject: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def claim_for_execution(self, workflow_id: UUID, subject: str) -> Workflow:
        raise NotImplementedError

    @abstractmethod
    async def save_execution(self, execution: WorkflowExecution, subject: str) -> WorkflowExecution:
        raise NotImplementedError

    @abstractmethod
    async def get_execution(self, workflow_id: UUID, subject: str) -> WorkflowExecution:
        raise NotImplementedError

    @abstractmethod
    async def consume_event(
        self,
        event_id: str,
        tenant_id: str,
        topic: str,
        payload: Any,
        actor_subject: str = "",
    ) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def recover_interrupted(self) -> int:
        raise NotImplementedError

    @abstractmethod
    async def ping(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def close(self) -> None:
        raise NotImplementedError


class MemoryWorkflowRepository(WorkflowRepository):
    """Explicit development fallback; never selected for production."""

    def __init__(self) -> None:
        self.workflows: dict[UUID, Workflow] = {}
        self.executions: dict[UUID, WorkflowExecution] = {}
        self.event_inbox: dict[str, dict[str, Any]] = {}
        self.event_dispatches: dict[tuple[str, UUID], dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def list(self, subject: str) -> list[Workflow]:
        async with self._lock:
            return [
                workflow.model_copy(deep=True)
                for workflow in self.workflows.values()
                if workflow.owner_subject == subject
            ]

    async def create(self, workflow: Workflow) -> Workflow:
        async with self._lock:
            self.workflows[workflow.id] = workflow.model_copy(deep=True)
            return self.workflows[workflow.id].model_copy(deep=True)

    async def get(self, workflow_id: UUID, subject: str) -> Workflow:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            return workflow.model_copy(deep=True)

    async def update(self, workflow: Workflow, subject: str) -> Workflow:
        async with self._lock:
            current = self.workflows.get(workflow.id)
            if current is None or current.owner_subject != subject:
                raise WorkflowNotFound
            self.workflows[workflow.id] = workflow.model_copy(deep=True)
            return self.workflows[workflow.id].model_copy(deep=True)

    async def delete(self, workflow_id: UUID, subject: str) -> None:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            del self.workflows[workflow_id]
            self.executions.pop(workflow_id, None)

    async def claim_for_execution(self, workflow_id: UUID, subject: str) -> Workflow:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            if workflow.status == WorkflowStatus.RUNNING:
                raise WorkflowAlreadyRunning
            workflow.status = WorkflowStatus.RUNNING
            workflow.executed_at = datetime.now(UTC)
            workflow.updated_at = datetime.now(UTC)
            return workflow.model_copy(deep=True)

    async def save_execution(self, execution: WorkflowExecution, subject: str) -> WorkflowExecution:
        async with self._lock:
            workflow = self.workflows.get(execution.workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            self.executions[execution.workflow_id] = execution.model_copy(deep=True)
            return self.executions[execution.workflow_id].model_copy(deep=True)

    async def get_execution(self, workflow_id: UUID, subject: str) -> WorkflowExecution:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            execution = self.executions.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject or execution is None:
                raise WorkflowNotFound
            return execution.model_copy(deep=True)

    async def consume_event(self, event_id: str, tenant_id: str, topic: str, payload: Any, actor_subject: str = "") -> bool:
        async with self._lock:
            if event_id in self.event_inbox:
                return False
            self.event_inbox[event_id] = {
                "tenant_id": tenant_id,
                "topic": topic,
                "payload": payload,
            }
            if actor_subject:
                for workflow in self.workflows.values():
                    if workflow.trigger_topic != topic or workflow.owner_subject != actor_subject or workflow.status == WorkflowStatus.RUNNING:
                        continue
                    self.event_dispatches[(event_id, workflow.id)] = {
                        "status": "pending",
                        "payload": payload,
                    }
            return True

    async def recover_interrupted(self) -> int:
        async with self._lock:
            recovered = 0
            for workflow in self.workflows.values():
                if workflow.status != WorkflowStatus.RUNNING:
                    continue
                workflow.status = WorkflowStatus.FAILED
                workflow.result = {"error": "execution interrupted by service restart"}
                workflow.updated_at = datetime.now(UTC)
                recovered += 1
            return recovered

    async def ping(self) -> None:
        return None

    async def close(self) -> None:
        return None


class PostgresWorkflowRepository(WorkflowRepository):
    """PostgreSQL repository with atomic execution claims."""

    _migration_path = Path(__file__).resolve().parents[1] / "migrations" / "001_workflows.sql"

    def __init__(self, pool: AsyncConnectionPool[Any]) -> None:
        self.pool = pool

    @classmethod
    async def connect(cls, database_url: str) -> PostgresWorkflowRepository:
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

    async def list(self, subject: str) -> list[Workflow]:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT id, owner_subject, name, description, trigger_topic, steps, status,
                           created_at, updated_at, executed_at, result
                    FROM axi_workflow.workflows
                    WHERE owner_subject = %s
                    ORDER BY created_at DESC, id DESC
                    """,
                    (subject,),
                )
                rows = await cursor.fetchall()
        return [_workflow_from_row(row) for row in rows]

    async def create(self, workflow: Workflow) -> Workflow:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    INSERT INTO axi_workflow.workflows
                        (id, owner_subject, name, description, trigger_topic, steps, status,
                         created_at, updated_at, executed_at, result)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    _workflow_values(workflow),
                )
            await connection.commit()
        return workflow

    async def get(self, workflow_id: UUID, subject: str) -> Workflow:
        row = await self._fetch_one(
            """
            SELECT id, owner_subject, name, description, trigger_topic, steps, status,
                   created_at, updated_at, executed_at, result
            FROM axi_workflow.workflows
            WHERE id = %s AND owner_subject = %s
            """,
            (workflow_id, subject),
        )
        if row is None:
            raise WorkflowNotFound
        return _workflow_from_row(row)

    async def update(self, workflow: Workflow, subject: str) -> Workflow:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE axi_workflow.workflows
                    SET name = %s, description = %s, trigger_topic = %s, steps = %s, status = %s,
                        updated_at = %s, executed_at = %s, result = %s
                    WHERE id = %s AND owner_subject = %s
                    """,
                    (
                        workflow.name,
                        workflow.description,
                        workflow.trigger_topic,
                        Jsonb(_json_steps(workflow.steps)),
                        workflow.status.value,
                        workflow.updated_at,
                        workflow.executed_at,
                        Jsonb(workflow.result) if workflow.result is not None else None,
                        workflow.id,
                        subject,
                    ),
                )
                if cursor.rowcount == 0:
                    raise WorkflowNotFound
            await connection.commit()
        return workflow

    async def delete(self, workflow_id: UUID, subject: str) -> None:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "DELETE FROM axi_workflow.workflows WHERE id = %s AND owner_subject = %s",
                    (workflow_id, subject),
                )
                if cursor.rowcount == 0:
                    raise WorkflowNotFound
            await connection.commit()

    async def claim_for_execution(self, workflow_id: UUID, subject: str) -> Workflow:
        now = datetime.now(UTC)
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE axi_workflow.workflows
                    SET status = 'running', executed_at = %s, updated_at = %s
                    WHERE id = %s AND owner_subject = %s AND status <> 'running'
                    RETURNING id, owner_subject, name, description, trigger_topic, steps, status,
                              created_at, updated_at, executed_at, result
                    """,
                    (now, now, workflow_id, subject),
                )
                row = await cursor.fetchone()
                if row is not None:
                    await connection.commit()
                    return _workflow_from_row(row)

                await cursor.execute(
                    "SELECT status FROM axi_workflow.workflows WHERE id = %s AND owner_subject = %s",
                    (workflow_id, subject),
                )
                status_row = await cursor.fetchone()
                await connection.rollback()
        if status_row is None:
            raise WorkflowNotFound
        if status_row[0] == WorkflowStatus.RUNNING.value:
            raise WorkflowAlreadyRunning
        raise WorkflowNotFound

    async def save_execution(self, execution: WorkflowExecution, subject: str) -> WorkflowExecution:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    INSERT INTO axi_workflow.executions
                        (workflow_id, status, started_at, completed_at, steps, result, error)
                    SELECT %s, %s, %s, %s, %s, %s, %s
                    WHERE EXISTS (
                        SELECT 1 FROM axi_workflow.workflows
                        WHERE id = %s AND owner_subject = %s
                    )
                    ON CONFLICT (workflow_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        started_at = EXCLUDED.started_at,
                        completed_at = EXCLUDED.completed_at,
                        steps = EXCLUDED.steps,
                        result = EXCLUDED.result,
                        error = EXCLUDED.error
                    """,
                    (
                        execution.workflow_id,
                        execution.status.value,
                        execution.started_at,
                        execution.completed_at,
                        Jsonb(_json_steps(execution.steps)),
                        Jsonb(execution.result) if execution.result is not None else None,
                        execution.error,
                        execution.workflow_id,
                        subject,
                    ),
                )
                if cursor.rowcount == 0:
                    raise WorkflowNotFound
            await connection.commit()
        return execution

    async def get_execution(self, workflow_id: UUID, subject: str) -> WorkflowExecution:
        row = await self._fetch_one(
            """
            SELECT execution.workflow_id, execution.status, execution.started_at,
                   execution.completed_at, execution.steps, execution.result, execution.error
            FROM axi_workflow.executions execution
            JOIN axi_workflow.workflows workflow ON workflow.id = execution.workflow_id
            WHERE execution.workflow_id = %s AND workflow.owner_subject = %s
            """,
            (workflow_id, subject),
        )
        if row is None:
            raise WorkflowNotFound
        return _execution_from_row(row)

    async def consume_event(self, event_id: str, tenant_id: str, topic: str, payload: Any, actor_subject: str = "") -> bool:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    INSERT INTO axi_workflow.event_inbox (event_id, tenant_id, topic, payload)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (event_id) DO NOTHING
                    RETURNING event_id
                    """,
                    (event_id, tenant_id, topic, Jsonb(payload)),
                )
                row = await cursor.fetchone()
                if row is not None and actor_subject:
                    await cursor.execute(
                        """
                        INSERT INTO axi_workflow.event_dispatches (event_id, workflow_id, payload)
                        SELECT %s, workflow.id, %s
                        FROM axi_workflow.workflows workflow
                        WHERE workflow.trigger_topic = %s
                          AND workflow.owner_subject = %s
                          AND workflow.status <> 'running'
                        ON CONFLICT (event_id, workflow_id) DO NOTHING
                        """,
                        (event_id, Jsonb(payload), topic, actor_subject),
                    )
                await connection.commit()
                return row is not None

    async def recover_interrupted(self) -> int:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE axi_workflow.workflows
                    SET status = 'failed',
                        result = %s,
                        updated_at = now()
                    WHERE status = 'running'
                    """,
                    (Jsonb({"error": "execution interrupted by service restart"}),),
                )
                recovered = cursor.rowcount
            await connection.commit()
        return recovered

    async def ping(self) -> None:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'axi_workflow' AND table_name = 'workflows'
                    """
                )
                if await cursor.fetchone() is None:
                    raise RuntimeError("workflow schema has not been migrated")

    async def close(self) -> None:
        await self.pool.close()

    async def _fetch_one(self, query: str, params: tuple[Any, ...]) -> tuple[Any, ...] | None:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(query, params)
                return await cursor.fetchone()


def _workflow_values(workflow: Workflow) -> tuple[Any, ...]:
    return (
        workflow.id,
        workflow.owner_subject,
        workflow.name,
        workflow.description,
        workflow.trigger_topic,
        Jsonb(_json_steps(workflow.steps)),
        workflow.status.value,
        workflow.created_at,
        workflow.updated_at,
        workflow.executed_at,
        Jsonb(workflow.result) if workflow.result is not None else None,
    )


def _json_steps(steps: list[Any]) -> list[dict[str, Any]]:
    return [step.model_dump(mode="json") if hasattr(step, "model_dump") else step for step in steps]


def _json_value(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value


def _workflow_from_row(row: tuple[Any, ...]) -> Workflow:
    return Workflow(
        id=row[0],
        owner_subject=row[1],
        name=row[2],
        description=row[3],
        trigger_topic=row[4],
        steps=_json_value(row[5]),
        status=WorkflowStatus(row[6]),
        created_at=row[7],
        updated_at=row[8],
        executed_at=row[9],
        result=_json_value(row[10]) if row[10] is not None else None,
    )


def _execution_from_row(row: tuple[Any, ...]) -> WorkflowExecution:
    return WorkflowExecution(
        workflow_id=row[0],
        status=WorkflowStatus(row[1]),
        started_at=row[2],
        completed_at=row[3],
        steps=_json_value(row[4]),
        result=_json_value(row[5]) if row[5] is not None else None,
        error=row[6],
    )
