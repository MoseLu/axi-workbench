"""Cache / dispatch / event-inbox segment of `PostgresWorkflowRepository`.

Contains the methods that mutate the event-inbox, the dispatch lease,
the waiting/completed/failed lifecycle, and the recovery sweep on
service restart. The durable migration helpers (`connect`,
`apply_migrations`) also live here because the cache layout owns the
`event_inbox` and `event_dispatches` tables.

This module holds only the PostgreSQL mixin segment. The in-memory
development repository lives in `memory.py`, and
`repository.index.PostgresWorkflowRepository` composes this mixin with
the query and mutation segments.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import tuple_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from models.workflow import (
    WorkflowExecution,
    WorkflowStatus,
)

from .helpers import (
    WorkflowDispatchLost,
    WorkflowNotFound,
    _approval_values,
    _json_steps,
)


class _PostgresCacheMixin:
    """Mixin for `PostgresWorkflowRepository` cache / dispatch paths.

    Hosts the SQL helpers that touch `axi_workflow.event_inbox` and
    `axi_workflow.event_dispatches`, plus the durable migration helpers
    (`connect`, `apply_migrations`).
    """

    pool: AsyncConnectionPool[Any]
    _migration_path: Path

    @classmethod
    async def connect(cls, database_url: str) -> "PostgresWorkflowRepository":
        pool: AsyncConnectionPool[Any] = AsyncConnectionPool(
            conninfo=database_url,
            min_size=1,
            max_size=10,
            open=False,
            kwargs={"row_factory": tuple_row},
        )
        await pool.open(wait=True)
        return cls(pool)  # type: ignore[return-value]

    @classmethod
    async def apply_migrations(cls, database_url: str) -> None:
        migration = cls._migration_path.read_text(encoding="utf-8")
        connection = await AsyncConnection.connect(database_url, row_factory=tuple_row)
        try:
            await connection.execute(migration)
            await connection.commit()
        finally:
            await connection.close()

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

    async def claim_event_dispatch(self, worker_id: str, lease_seconds: int) -> "WorkflowDispatch | None":
        lease_until = datetime.now(UTC) + timedelta(seconds=lease_seconds)
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                while True:
                    await cursor.execute(
                        """
                        SELECT dispatch.event_id, dispatch.workflow_id, workflow.owner_subject,
                               dispatch.payload, dispatch.status, dispatch.attempts, workflow.status
                        FROM axi_workflow.event_dispatches dispatch
                        JOIN axi_workflow.workflows workflow ON workflow.id = dispatch.workflow_id
                        WHERE (
                            (dispatch.status = 'pending'
                             AND dispatch.next_attempt_at <= now()
                             AND workflow.status <> 'running')
                            OR
                            (dispatch.status = 'running'
                             AND (dispatch.locked_until IS NULL OR dispatch.locked_until <= now()))
                        )
                        ORDER BY dispatch.next_attempt_at, dispatch.created_at
                        FOR UPDATE OF dispatch, workflow SKIP LOCKED
                        LIMIT 1
                        """
                    )
                    row = await cursor.fetchone()
                    if row is None:
                        await connection.commit()
                        return None

                    event_id, workflow_id, owner_subject, payload, dispatch_status, attempts, workflow_status = row
                    if dispatch_status == "running" and workflow_status in {
                        WorkflowStatus.COMPLETED.value,
                        WorkflowStatus.FAILED.value,
                        WorkflowStatus.CANCELLED.value,
                    }:
                        await cursor.execute(
                            """
                            UPDATE axi_workflow.event_dispatches
                            SET status = %s, completed_at = now(), locked_by = NULL, locked_until = NULL
                            WHERE event_id = %s AND workflow_id = %s
                            """,
                            (workflow_status, event_id, workflow_id),
                        )
                        continue

                    if dispatch_status == "running" and workflow_status == WorkflowStatus.RUNNING.value:
                        await cursor.execute(
                            """
                            UPDATE axi_workflow.workflows
                            SET status = 'failed',
                                result = %s,
                                updated_at = now()
                            WHERE id = %s AND status = 'running'
                            """,
                            (Jsonb({"error": "workflow dispatch lease expired"}), workflow_id),
                        )

                    await cursor.execute(
                        """
                        UPDATE axi_workflow.event_dispatches
                        SET status = 'running',
                            attempts = attempts + 1,
                            locked_by = %s,
                            locked_until = %s,
                            started_at = COALESCE(started_at, now()),
                            last_error = NULL
                        WHERE event_id = %s AND workflow_id = %s
                        """,
                        (worker_id, lease_until, event_id, workflow_id),
                    )
                    await connection.commit()
                    # Import here to dodge the circular import in some
                    # module-load orders.
                    from .index import WorkflowDispatch

                    return WorkflowDispatch(
                        event_id=event_id,
                        workflow_id=workflow_id,
                        owner_subject=owner_subject,
                        payload=payload,
                        attempts=attempts + 1,
                    )

    async def complete_event_dispatch(
        self,
        dispatch: "WorkflowDispatch",
        execution: WorkflowExecution,
        worker_id: str,
    ) -> None:
        dispatch_status = (
            "waiting"
            if execution.status == WorkflowStatus.WAITING_APPROVAL
            else "completed"
            if execution.status == WorkflowStatus.COMPLETED
            else "failed"
        )
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE axi_workflow.workflows
                    SET status = %s, result = %s, updated_at = now()
                    WHERE id = %s AND owner_subject = %s AND status = 'running'
                    """,
                    (
                        execution.status.value,
                        Jsonb(execution.result) if execution.result is not None else None,
                        dispatch.workflow_id,
                        dispatch.owner_subject,
                    ),
                )
                if cursor.rowcount == 0:
                    raise WorkflowNotFound
                await cursor.execute(
                    """
                    INSERT INTO axi_workflow.executions
                        (workflow_id, status, started_at, completed_at, steps, result, error, pending_approval)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (workflow_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        started_at = EXCLUDED.started_at,
                        completed_at = EXCLUDED.completed_at,
                        steps = EXCLUDED.steps,
                        result = EXCLUDED.result,
                        error = EXCLUDED.error,
                        pending_approval = EXCLUDED.pending_approval
                    """,
                    (
                        execution.workflow_id,
                        execution.status.value,
                        execution.started_at,
                        execution.completed_at,
                        Jsonb(_json_steps(execution.steps)),
                        Jsonb(execution.result) if execution.result is not None else None,
                        execution.error,
                        Jsonb(execution.pending_approval.model_dump(mode="json", by_alias=True, exclude={"owner_subject"}))
                        if execution.pending_approval is not None
                        else None,
                    ),
                )
                if execution.pending_approval is not None:
                    execution.pending_approval.owner_subject = dispatch.owner_subject
                    await cursor.execute(
                        """
                        INSERT INTO axi_workflow.approvals
                            (id, workflow_id, step_id, owner_subject, step_name, prompt,
                             approvers, status, requested_at, decided_at, decided_by, decision_comment,
                             action_digest, effect_action, grant_permissions)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        _approval_values(execution.pending_approval),
                    )
                await cursor.execute(
                    """
                    UPDATE axi_workflow.event_dispatches
                    SET status = %s,
                        completed_at = CASE WHEN %s THEN NULL ELSE now() END,
                        locked_by = NULL,
                        locked_until = NULL,
                        last_error = %s
                    WHERE event_id = %s AND workflow_id = %s
                      AND status = 'running' AND locked_by = %s
                    """,
                    (
                        dispatch_status,
                        dispatch_status != "waiting",
                        execution.error,
                        dispatch.event_id,
                        dispatch.workflow_id,
                        worker_id,
                    ),
                )
                if cursor.rowcount == 0:
                    raise WorkflowDispatchLost
            await connection.commit()

    async def complete_waiting_dispatch(
        self,
        workflow_id: UUID,
        execution: WorkflowExecution,
    ) -> None:
        status = "completed" if execution.status == WorkflowStatus.COMPLETED else "failed"
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE axi_workflow.event_dispatches
                    SET status = %s, completed_at = now(), last_error = %s,
                        locked_by = NULL, locked_until = NULL
                    WHERE workflow_id = %s AND status = 'waiting'
                    """,
                    (status, execution.error, workflow_id),
                )
            await connection.commit()

    async def renew_event_dispatch(
        self,
        dispatch: "WorkflowDispatch",
        worker_id: str,
        lease_seconds: int,
    ) -> bool:
        locked_until = datetime.now(UTC) + timedelta(seconds=lease_seconds)
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE axi_workflow.event_dispatches
                    SET locked_until = %s
                    WHERE event_id = %s AND workflow_id = %s
                      AND status = 'running' AND locked_by = %s
                    """,
                    (locked_until, dispatch.event_id, dispatch.workflow_id, worker_id),
                )
                renewed = cursor.rowcount > 0
            await connection.commit()
        return renewed

    async def fail_event_dispatch(
        self,
        dispatch: "WorkflowDispatch",
        worker_id: str,
        error: str,
        retry_at: datetime | None,
        max_attempts: int,
        retry: bool = True,
        reset_workflow: bool = False,
    ) -> None:
        now = datetime.now(UTC)
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT attempts
                    FROM axi_workflow.event_dispatches
                    WHERE event_id = %s AND workflow_id = %s
                      AND status = 'running' AND locked_by = %s
                    FOR UPDATE
                    """,
                    (dispatch.event_id, dispatch.workflow_id, worker_id),
                )
                row = await cursor.fetchone()
                if row is None:
                    raise WorkflowDispatchLost
                terminal = not retry or row[0] >= max_attempts
                if reset_workflow:
                    await cursor.execute(
                        """
                        UPDATE axi_workflow.workflows
                        SET status = 'failed',
                            result = %s,
                            updated_at = now()
                        WHERE id = %s AND owner_subject = %s AND status = 'running'
                        """,
                        (
                            Jsonb({"error": error}),
                            dispatch.workflow_id,
                            dispatch.owner_subject,
                        ),
                    )
                await cursor.execute(
                    """
                    UPDATE axi_workflow.event_dispatches
                    SET status = %s,
                        next_attempt_at = %s,
                        completed_at = CASE WHEN %s THEN now() ELSE NULL END,
                        locked_by = NULL,
                        locked_until = NULL,
                        last_error = %s
                    WHERE event_id = %s AND workflow_id = %s
                    """,
                    (
                        "failed" if terminal else "pending",
                        retry_at or now,
                        terminal,
                        error,
                        dispatch.event_id,
                        dispatch.workflow_id,
                    ),
                )
            await connection.commit()

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
                      AND NOT EXISTS (
                          SELECT 1
                          FROM axi_workflow.event_dispatches dispatch
                          WHERE dispatch.workflow_id = axi_workflow.workflows.id
                            AND dispatch.status = 'running'
                            AND dispatch.locked_until > now()
                      )
                    """,
                    (Jsonb({"error": "execution interrupted by service restart"}),),
                )
                recovered = cursor.rowcount
                await cursor.execute(
                    """
                    UPDATE axi_workflow.event_dispatches
                    SET status = 'pending',
                        next_attempt_at = now(),
                        locked_by = NULL,
                        locked_until = NULL,
                        last_error = 'dispatch lease reset after service restart'
                    WHERE status = 'running'
                      AND (locked_until IS NULL OR locked_until <= now())
                    """
                )
            await connection.commit()
        return recovered
