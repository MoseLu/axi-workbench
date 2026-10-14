"""Mutation segment of `PostgresWorkflowRepository`.

Contains the methods that mutate the durable `axi_workflow.workflows`,
`axi_workflow.executions`, and `axi_workflow.approvals` tables:
create / update / delete / claim_for_execution / save_execution /
cancel_execution / approve_and_claim. The `close` lifecycle helper
also lives here because it owns the pool teardown side of writes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from models.workflow import (
    Workflow,
    WorkflowApproval,
    WorkflowApprovalStatus,
    WorkflowExecution,
    WorkflowStatus,
)

from .helpers import (  # noqa: F401  (re-export)
    WorkflowApprovalConflict,
    WorkflowApprovalForbidden,
    WorkflowApprovalNotFound,
    WorkflowCancellationConflict,
    WorkflowNotFound,
    _approval_values,
    _execution_from_row,
    _json_steps,
    _workflow_from_row,
)


class _PostgresMutationMixin:
    """Mixin for `PostgresWorkflowRepository` SQL write paths."""

    pool: AsyncConnectionPool[Any]

    async def create(self, workflow: Workflow) -> Workflow:
        from .helpers import _workflow_values

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
                    WHERE id = %s AND owner_subject = %s
                      AND status NOT IN ('running', 'waiting_approval')
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
            from .helpers import WorkflowAlreadyRunning

            raise WorkflowAlreadyRunning
        if status_row[0] == WorkflowStatus.WAITING_APPROVAL.value:
            from .helpers import WorkflowWaitingApproval

            raise WorkflowWaitingApproval
        raise WorkflowNotFound

    async def save_execution(self, execution: WorkflowExecution, subject: str) -> WorkflowExecution:
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    INSERT INTO axi_workflow.executions
                        (workflow_id, status, started_at, completed_at, steps, result, error, pending_approval)
                    SELECT %s, %s, %s, %s, %s, %s, %s, %s
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
                        execution.workflow_id,
                        subject,
                    ),
                )
                if cursor.rowcount == 0:
                    raise WorkflowNotFound
                if execution.pending_approval is not None:
                    execution.pending_approval.owner_subject = subject
                    await cursor.execute(
                        """
                        INSERT INTO axi_workflow.approvals
                            (id, workflow_id, step_id, owner_subject, step_name, prompt,
                             approvers, status, requested_at, decided_at, decided_by, decision_comment,
                             action_digest, effect_action, grant_permissions)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            owner_subject = EXCLUDED.owner_subject,
                            step_name = EXCLUDED.step_name,
                            prompt = EXCLUDED.prompt,
                            approvers = EXCLUDED.approvers,
                            status = EXCLUDED.status,
                            requested_at = EXCLUDED.requested_at,
                            decided_at = EXCLUDED.decided_at,
                            decided_by = EXCLUDED.decided_by,
                            decision_comment = EXCLUDED.decision_comment,
                            action_digest = EXCLUDED.action_digest,
                            effect_action = EXCLUDED.effect_action,
                            grant_permissions = EXCLUDED.grant_permissions
                        WHERE axi_workflow.approvals.status = 'pending'
                        """,
                        _approval_values(execution.pending_approval),
                    )
                    if cursor.rowcount == 0:
                        raise WorkflowApprovalConflict
            await connection.commit()
        return execution

    async def cancel_execution(
        self,
        workflow_id: UUID,
        subject: str,
        comment: str | None = None,
    ) -> WorkflowExecution:
        now = datetime.now(UTC)
        error = comment or "workflow cancelled"
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT id, owner_subject, name, description, trigger_topic, steps, status,
                           created_at, updated_at, executed_at, result
                    FROM axi_workflow.workflows
                    WHERE id = %s AND owner_subject = %s
                    FOR UPDATE
                    """,
                    (workflow_id, subject),
                )
                workflow_row = await cursor.fetchone()
                if workflow_row is None:
                    raise WorkflowNotFound
                if workflow_row[6] != WorkflowStatus.WAITING_APPROVAL.value:
                    raise WorkflowCancellationConflict
                await cursor.execute(
                    """
                    SELECT execution.workflow_id, execution.status, execution.started_at,
                           execution.completed_at, execution.steps, execution.result, execution.error,
                           execution.pending_approval
                    FROM axi_workflow.executions execution
                    WHERE execution.workflow_id = %s
                    FOR UPDATE
                    """,
                    (workflow_id,),
                )
                execution_row = await cursor.fetchone()
                if execution_row is None:
                    raise WorkflowCancellationConflict
                await cursor.execute(
                    """
                    UPDATE axi_workflow.workflows
                    SET status = 'cancelled', updated_at = %s
                    WHERE id = %s AND status = 'waiting_approval'
                    """,
                    (now, workflow_id),
                )
                if cursor.rowcount == 0:
                    raise WorkflowCancellationConflict
                await cursor.execute(
                    """
                    UPDATE axi_workflow.executions
                    SET status = 'cancelled', completed_at = %s, error = %s, pending_approval = NULL
                    WHERE workflow_id = %s
                    """,
                    (now, error, workflow_id),
                )
                await cursor.execute(
                    """
                    UPDATE axi_workflow.approvals
                    SET status = 'rejected', decided_at = %s, decided_by = %s, decision_comment = %s
                    WHERE workflow_id = %s AND status = 'pending'
                    """,
                    (now, subject, error, workflow_id),
                )
                await cursor.execute(
                    """
                    UPDATE axi_workflow.event_dispatches
                    SET status = 'failed', locked_by = NULL, locked_until = NULL, last_error = %s
                    WHERE workflow_id = %s AND status IN ('pending', 'running', 'waiting')
                    """,
                    (error, workflow_id),
                )
            await connection.commit()
        execution = _execution_from_row(execution_row)
        execution.status = WorkflowStatus.CANCELLED
        execution.completed_at = now
        execution.error = error
        execution.pending_approval = None
        return execution

    async def approve_and_claim(
        self,
        approval_id: UUID,
        workflow_id: UUID,
        subject: str,
        decision: WorkflowApprovalStatus,
        comment: str | None,
    ) -> tuple[Workflow, WorkflowExecution, WorkflowApproval]:
        now = datetime.now(UTC)
        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT id, workflow_id, step_id, owner_subject, step_name, prompt,
                           approvers, status, requested_at, decided_at, decided_by, decision_comment,
                           action_digest, effect_action, grant_permissions
                    FROM axi_workflow.approvals
                    WHERE id = %s AND workflow_id = %s
                    FOR UPDATE
                    """,
                    (approval_id, workflow_id),
                )
                approval_row = await cursor.fetchone()
                if approval_row is None:
                    raise WorkflowApprovalNotFound
                approval = _approval_from_row(approval_row)
                if not approval.can_be_decided_by(subject):
                    raise WorkflowApprovalForbidden
                if approval.status != WorkflowApprovalStatus.PENDING:
                    raise WorkflowApprovalConflict

                await cursor.execute(
                    """
                    SELECT id, owner_subject, name, description, trigger_topic, steps, status,
                           created_at, updated_at, executed_at, result
                    FROM axi_workflow.workflows
                    WHERE id = %s AND owner_subject = %s AND status = 'waiting_approval'
                    FOR UPDATE
                    """,
                    (approval.workflow_id, approval.owner_subject),
                )
                workflow_row = await cursor.fetchone()
                if workflow_row is None:
                    raise WorkflowApprovalConflict
                await cursor.execute(
                    """
                    SELECT execution.workflow_id, execution.status, execution.started_at,
                           execution.completed_at, execution.steps, execution.result, execution.error,
                           execution.pending_approval
                    FROM axi_workflow.executions execution
                    WHERE execution.workflow_id = %s
                    FOR UPDATE
                    """,
                    (approval.workflow_id,),
                )
                execution_row = await cursor.fetchone()
                if execution_row is None:
                    raise WorkflowApprovalConflict
                await cursor.execute(
                    """
                    UPDATE axi_workflow.approvals
                    SET status = %s, decided_at = %s, decided_by = %s, decision_comment = %s
                    WHERE id = %s AND status = 'pending'
                    """,
                    (decision.value, now, subject, comment, approval_id),
                )
                if cursor.rowcount == 0:
                    raise WorkflowApprovalConflict
                await cursor.execute(
                    """
                    UPDATE axi_workflow.workflows
                    SET status = 'running', updated_at = %s
                    WHERE id = %s AND status = 'waiting_approval'
                    """,
                    (now, approval.workflow_id),
                )
                if cursor.rowcount == 0:
                    raise WorkflowApprovalConflict
                await connection.commit()
        approval.status = decision
        approval.decided_at = now
        approval.decided_by = subject
        approval.decision_comment = comment
        workflow = _workflow_from_row(workflow_row)
        workflow.status = WorkflowStatus.RUNNING
        workflow.updated_at = now
        return workflow, _execution_from_row(execution_row), approval

    async def close(self) -> None:
        await self.pool.close()
