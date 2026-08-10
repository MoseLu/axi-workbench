"""Durable and development repositories for workflow state."""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import tuple_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from models.workflow import (
    Workflow,
    WorkflowApproval,
    WorkflowApprovalStatus,
    WorkflowExecution,
    WorkflowStatus,
)


class WorkflowNotFound(Exception):
    """The workflow is absent or owned by another subject."""


class WorkflowAlreadyRunning(Exception):
    """The workflow has already been claimed by another execution."""


class WorkflowWaitingApproval(Exception):
    """The workflow cannot be started again while an approval is pending."""


class WorkflowApprovalNotFound(Exception):
    """The approval request is absent or belongs to another workflow."""


class WorkflowApprovalForbidden(Exception):
    """The caller is not an allowed approver for the request."""


class WorkflowApprovalConflict(Exception):
    """The approval was already decided or its workflow is not waiting."""


class WorkflowCancellationConflict(Exception):
    """The workflow has no cancellable durable execution."""


class WorkflowDispatchLost(Exception):
    """The worker no longer owns the dispatch lease."""


@dataclass(frozen=True)
class WorkflowDispatch:
    """A leased event-to-workflow execution request."""

    event_id: str
    workflow_id: UUID
    owner_subject: str
    payload: Any
    attempts: int


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
    async def cancel_execution(
        self,
        workflow_id: UUID,
        subject: str,
        comment: str | None = None,
    ) -> WorkflowExecution:
        raise NotImplementedError

    @abstractmethod
    async def approve_and_claim(
        self,
        approval_id: UUID,
        workflow_id: UUID,
        subject: str,
        decision: WorkflowApprovalStatus,
        comment: str | None,
    ) -> tuple[Workflow, WorkflowExecution, WorkflowApproval]:
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
    async def claim_event_dispatch(self, worker_id: str, lease_seconds: int) -> WorkflowDispatch | None:
        raise NotImplementedError

    @abstractmethod
    async def complete_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
        execution: WorkflowExecution,
        worker_id: str,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def complete_waiting_dispatch(
        self,
        workflow_id: UUID,
        execution: WorkflowExecution,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def renew_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
        worker_id: str,
        lease_seconds: int,
    ) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def fail_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
        worker_id: str,
        error: str,
        retry_at: datetime | None,
        max_attempts: int,
        retry: bool = True,
        reset_workflow: bool = False,
    ) -> None:
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
        self.approvals: dict[UUID, WorkflowApproval] = {}
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
            for approval_id in [
                approval_id for approval_id, approval in self.approvals.items() if approval.workflow_id == workflow_id
            ]:
                del self.approvals[approval_id]
            for key in [key for key in self.event_dispatches if key[1] == workflow_id]:
                del self.event_dispatches[key]

    async def claim_for_execution(self, workflow_id: UUID, subject: str) -> Workflow:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            if workflow.status == WorkflowStatus.RUNNING:
                raise WorkflowAlreadyRunning
            if workflow.status == WorkflowStatus.WAITING_APPROVAL:
                raise WorkflowWaitingApproval
            workflow.status = WorkflowStatus.RUNNING
            workflow.executed_at = datetime.now(UTC)
            workflow.updated_at = datetime.now(UTC)
            return workflow.model_copy(deep=True)

    async def save_execution(self, execution: WorkflowExecution, subject: str) -> WorkflowExecution:
        async with self._lock:
            workflow = self.workflows.get(execution.workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            if execution.pending_approval is not None:
                execution.pending_approval.owner_subject = subject
                existing = self.approvals.get(execution.pending_approval.id)
                if existing is not None and existing.status != WorkflowApprovalStatus.PENDING:
                    raise WorkflowApprovalConflict
                self.approvals[execution.pending_approval.id] = execution.pending_approval.model_copy(deep=True)
            self.executions[execution.workflow_id] = execution.model_copy(deep=True)
            return self.executions[execution.workflow_id].model_copy(deep=True)

    async def get_execution(self, workflow_id: UUID, subject: str) -> WorkflowExecution:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            execution = self.executions.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject or execution is None:
                raise WorkflowNotFound
            return execution.model_copy(deep=True)

    async def cancel_execution(
        self,
        workflow_id: UUID,
        subject: str,
        comment: str | None = None,
    ) -> WorkflowExecution:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            execution = self.executions.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject or execution is None:
                raise WorkflowNotFound
            if workflow.status != WorkflowStatus.WAITING_APPROVAL:
                raise WorkflowCancellationConflict
            now = datetime.now(UTC)
            workflow.status = WorkflowStatus.CANCELLED
            workflow.updated_at = now
            workflow.result = execution.result
            execution.status = WorkflowStatus.CANCELLED
            execution.completed_at = now
            execution.error = comment or "workflow cancelled"
            if execution.pending_approval is not None:
                approval = self.approvals.get(execution.pending_approval.id)
                if approval is not None and approval.status == WorkflowApprovalStatus.PENDING:
                    approval.status = WorkflowApprovalStatus.REJECTED
                    approval.decided_at = now
                    approval.decided_by = subject
                    approval.decision_comment = execution.error
            execution.pending_approval = None
            for (event_id, dispatch_workflow_id), dispatch in self.event_dispatches.items():
                if dispatch_workflow_id == workflow_id and dispatch.get("status") in {"pending", "running", "waiting"}:
                    dispatch.update({"status": "failed", "last_error": execution.error, "locked_by": None, "locked_until": None})
            self.workflows[workflow_id] = workflow.model_copy(deep=True)
            self.executions[workflow_id] = execution.model_copy(deep=True)
            return self.executions[workflow_id].model_copy(deep=True)

    async def approve_and_claim(
        self,
        approval_id: UUID,
        workflow_id: UUID,
        subject: str,
        decision: WorkflowApprovalStatus,
        comment: str | None,
    ) -> tuple[Workflow, WorkflowExecution, WorkflowApproval]:
        async with self._lock:
            approval = self.approvals.get(approval_id)
            if approval is None or approval.workflow_id != workflow_id:
                raise WorkflowApprovalNotFound
            if not approval.can_be_decided_by(subject):
                raise WorkflowApprovalForbidden
            if approval.status != WorkflowApprovalStatus.PENDING:
                raise WorkflowApprovalConflict
            workflow = self.workflows.get(approval.workflow_id)
            execution = self.executions.get(approval.workflow_id)
            if workflow is None or execution is None:
                raise WorkflowApprovalNotFound
            if workflow.status != WorkflowStatus.WAITING_APPROVAL:
                raise WorkflowApprovalConflict
            approval.status = decision
            approval.decided_at = datetime.now(UTC)
            approval.decided_by = subject
            approval.decision_comment = comment
            workflow.status = WorkflowStatus.RUNNING
            workflow.updated_at = datetime.now(UTC)
            return (
                workflow.model_copy(deep=True),
                execution.model_copy(deep=True),
                approval.model_copy(deep=True),
            )

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
                        "attempts": 0,
                        "next_attempt_at": datetime.now(UTC),
                        "payload": payload,
                    }
            return True

    async def claim_event_dispatch(self, worker_id: str, lease_seconds: int) -> WorkflowDispatch | None:
        now = datetime.now(UTC)
        async with self._lock:
            for (event_id, workflow_id), dispatch in self.event_dispatches.items():
                workflow = self.workflows.get(workflow_id)
                if workflow is None:
                    dispatch.update(status="failed", last_error="workflow was deleted", completed_at=now)
                    continue

                status = dispatch.get("status", "pending")
                locked_until = dispatch.get("locked_until")
                if status == "pending":
                    if dispatch.get("next_attempt_at", now) > now or workflow.status == WorkflowStatus.RUNNING:
                        continue
                elif status == "running":
                    if locked_until is not None and locked_until > now:
                        continue
                    if workflow.status in {
                        WorkflowStatus.COMPLETED,
                        WorkflowStatus.FAILED,
                        WorkflowStatus.CANCELLED,
                    }:
                        dispatch.update(
                            status=workflow.status.value,
                            completed_at=now,
                            locked_by=None,
                            locked_until=None,
                        )
                        continue
                    if workflow.status == WorkflowStatus.RUNNING:
                        workflow.status = WorkflowStatus.FAILED
                        workflow.result = {"error": "workflow dispatch lease expired"}
                        workflow.updated_at = now
                else:
                    continue

                attempts = int(dispatch.get("attempts", 0)) + 1
                dispatch.update(
                    status="running",
                    attempts=attempts,
                    locked_by=worker_id,
                    locked_until=now + timedelta(seconds=lease_seconds),
                    started_at=dispatch.get("started_at", now),
                    last_error=None,
                )
                return WorkflowDispatch(
                    event_id=event_id,
                    workflow_id=workflow_id,
                    owner_subject=workflow.owner_subject,
                    payload=dispatch.get("payload", {}),
                    attempts=attempts,
                )
            return None

    async def complete_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
        execution: WorkflowExecution,
        worker_id: str,
    ) -> None:
        now = datetime.now(UTC)
        async with self._lock:
            stored_dispatch = self.event_dispatches.get((dispatch.event_id, dispatch.workflow_id))
            if stored_dispatch is None or stored_dispatch.get("locked_by") != worker_id:
                raise WorkflowDispatchLost
            workflow = self.workflows.get(dispatch.workflow_id)
            if workflow is None or workflow.owner_subject != dispatch.owner_subject:
                raise WorkflowNotFound
            workflow.status = execution.status
            workflow.result = execution.result
            workflow.updated_at = now
            if execution.pending_approval is not None:
                execution.pending_approval.owner_subject = dispatch.owner_subject
                self.approvals[execution.pending_approval.id] = execution.pending_approval.model_copy(deep=True)
            self.executions[execution.workflow_id] = execution.model_copy(deep=True)
            dispatch_status = "waiting" if execution.status == WorkflowStatus.WAITING_APPROVAL else (
                "completed" if execution.status == WorkflowStatus.COMPLETED else "failed"
            )
            stored_dispatch.update(
                status=dispatch_status,
                completed_at=None if dispatch_status == "waiting" else now,
                locked_by=None,
                locked_until=None,
                last_error=execution.error,
            )

    async def complete_waiting_dispatch(
        self,
        workflow_id: UUID,
        execution: WorkflowExecution,
    ) -> None:
        now = datetime.now(UTC)
        async with self._lock:
            status = "completed" if execution.status == WorkflowStatus.COMPLETED else "failed"
            for (event_id, dispatch_workflow_id), dispatch in self.event_dispatches.items():
                if dispatch_workflow_id != workflow_id or dispatch.get("status") != "waiting":
                    continue
                dispatch.update(
                    status=status,
                    completed_at=now,
                    last_error=execution.error,
                    locked_by=None,
                    locked_until=None,
                )

    async def renew_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
        worker_id: str,
        lease_seconds: int,
    ) -> bool:
        async with self._lock:
            stored_dispatch = self.event_dispatches.get((dispatch.event_id, dispatch.workflow_id))
            if stored_dispatch is None or stored_dispatch.get("locked_by") != worker_id:
                return False
            stored_dispatch["locked_until"] = datetime.now(UTC) + timedelta(seconds=lease_seconds)
            return True

    async def fail_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
        worker_id: str,
        error: str,
        retry_at: datetime | None,
        max_attempts: int,
        retry: bool = True,
        reset_workflow: bool = False,
    ) -> None:
        now = datetime.now(UTC)
        async with self._lock:
            stored_dispatch = self.event_dispatches.get((dispatch.event_id, dispatch.workflow_id))
            if stored_dispatch is None or stored_dispatch.get("locked_by") != worker_id:
                raise WorkflowDispatchLost
            workflow = self.workflows.get(dispatch.workflow_id)
            if reset_workflow and workflow is not None and workflow.status == WorkflowStatus.RUNNING:
                workflow.status = WorkflowStatus.FAILED
                workflow.result = {"error": error}
                workflow.updated_at = now
            terminal = not retry or int(stored_dispatch.get("attempts", 0)) >= max_attempts
            stored_dispatch.update(
                status="failed" if terminal else "pending",
                next_attempt_at=retry_at or now,
                completed_at=now if terminal else None,
                locked_by=None,
                locked_until=None,
                last_error=error,
            )

    async def recover_interrupted(self) -> int:
        async with self._lock:
            now = datetime.now(UTC)
            recovered = 0
            for workflow in self.workflows.values():
                if workflow.status != WorkflowStatus.RUNNING:
                    continue
                active_dispatch = any(
                    dispatch.get("status") == "running"
                    and dispatch.get("locked_until") is not None
                    and dispatch["locked_until"] > now
                    for (event_id, workflow_id), dispatch in self.event_dispatches.items()
                    if workflow_id == workflow.id
                )
                if active_dispatch:
                    continue
                workflow.status = WorkflowStatus.FAILED
                workflow.result = {"error": "execution interrupted by service restart"}
                workflow.updated_at = now
                recovered += 1
            for dispatch in self.event_dispatches.values():
                if dispatch.get("status") != "running":
                    continue
                locked_until = dispatch.get("locked_until")
                if locked_until is not None and locked_until > now:
                    continue
                dispatch.update(
                    status="pending",
                    next_attempt_at=now,
                    locked_by=None,
                    locked_until=None,
                    last_error="dispatch lease reset after service restart",
                )
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
            raise WorkflowAlreadyRunning
        if status_row[0] == WorkflowStatus.WAITING_APPROVAL.value:
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

    async def claim_event_dispatch(self, worker_id: str, lease_seconds: int) -> WorkflowDispatch | None:
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
                    return WorkflowDispatch(
                        event_id=event_id,
                        workflow_id=workflow_id,
                        owner_subject=owner_subject,
                        payload=payload,
                        attempts=attempts + 1,
                    )

    async def complete_event_dispatch(
        self,
        dispatch: WorkflowDispatch,
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
        dispatch: WorkflowDispatch,
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
        dispatch: WorkflowDispatch,
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


def _approval_values(approval: WorkflowApproval) -> tuple[Any, ...]:
    return (
        approval.id,
        approval.workflow_id,
        approval.step_id,
        approval.owner_subject,
        approval.step_name,
        approval.prompt,
        Jsonb(approval.approvers),
        approval.status.value,
        approval.requested_at,
        approval.decided_at,
        approval.decided_by,
        approval.decision_comment,
        approval.action_digest,
        Jsonb(approval.effect_action) if approval.effect_action is not None else None,
        Jsonb(approval.grant_permissions),
    )


def _approval_from_row(row: tuple[Any, ...]) -> WorkflowApproval:
    return WorkflowApproval(
        id=row[0],
        workflow_id=row[1],
        step_id=row[2],
        owner_subject=row[3],
        step_name=row[4],
        prompt=row[5],
        approvers=_json_value(row[6]),
        status=WorkflowApprovalStatus(row[7]),
        requested_at=row[8],
        decided_at=row[9],
        decided_by=row[10],
        decision_comment=row[11],
        action_digest=row[12],
        effect_action=_json_value(row[13]) if row[13] is not None else None,
        grant_permissions=_json_value(row[14]) if row[14] is not None else [],
    )


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
        pending_approval=(
            WorkflowApproval.model_validate(_json_value(row[7])) if row[7] is not None else None
        ),
    )
