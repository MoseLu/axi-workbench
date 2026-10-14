"""Query segment of `PostgresWorkflowRepository`.

Contains the read-only SQL helpers: `list`, `get`, `get_execution`,
`list_approvals`, `ping` (schema liveness probe), and the
`_fetch_one` plumbing. Mutations live in `mutation.py`; cache /
dispatch paths live in `cache.py`.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg_pool import AsyncConnectionPool

from models.workflow import Workflow, WorkflowApproval, WorkflowExecution

from .helpers import (  # noqa: F401  (re-export)
    WorkflowNotFound,
    _approval_from_row,
    _execution_from_row,
    _workflow_from_row,
)


class _PostgresQueryMixin:
    """Mixin for `PostgresWorkflowRepository` SQL read paths."""

    pool: AsyncConnectionPool[Any]

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

    async def get_execution(self, workflow_id: UUID, subject: str) -> WorkflowExecution:
        row = await self._fetch_one(
            """
            SELECT execution.workflow_id, execution.status, execution.started_at,
                   execution.completed_at, execution.steps, execution.result, execution.error,
                   execution.pending_approval
            FROM axi_workflow.executions execution
            JOIN axi_workflow.workflows workflow ON workflow.id = execution.workflow_id
            WHERE execution.workflow_id = %s AND workflow.owner_subject = %s
            """,
            (workflow_id, subject),
        )
        if row is None:
            raise WorkflowNotFound
        return _execution_from_row(row)

    async def list_approvals(self, workflow_id: UUID, subject: str) -> list[WorkflowApproval]:
        # Check the owning workflow first so an unknown or unauthorized ID is
        # not indistinguishable from a workflow with no approvals.
        await self.get(workflow_id, subject)
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT id, workflow_id, step_id, owner_subject, step_name, prompt,
                           approvers, status, requested_at, decided_at, decided_by, decision_comment,
                           action_digest, effect_action, grant_permissions
                    FROM axi_workflow.approvals
                    WHERE workflow_id = %s AND owner_subject = %s
                    ORDER BY requested_at DESC, id DESC
                    """,
                    (workflow_id, subject),
                )
                rows = await cursor.fetchall()
        return [_approval_from_row(row) for row in rows]

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

    async def _fetch_one(self, query: str, params: tuple[Any, ...]) -> tuple[Any, ...] | None:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(query, params)
                return await cursor.fetchone()
