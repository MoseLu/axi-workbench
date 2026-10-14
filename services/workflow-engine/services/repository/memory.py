"""In-memory `WorkflowRepository` implementation.

`MemoryWorkflowRepository` is the explicit development fallback used when
no PostgreSQL `DATABASE_URL` is configured. It mirrors the durable
event-dispatch lifecycle (inbox de-duplication, leases, waiting/terminal
transitions, restart recovery) with plain dicts guarded by a single
`asyncio.Lock`, and is never selected for production traffic.

It lives in its own module instead of alongside the Postgres cache
segment so each repository implementation stays reviewable on its own
and no single file in this package grows past ~400 lines.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from models.workflow import (
    Workflow,
    WorkflowApproval,
    WorkflowApprovalStatus,
    WorkflowExecution,
    WorkflowStatus,
)

from .helpers import (
    WorkflowAlreadyRunning,
    WorkflowApprovalConflict,
    WorkflowApprovalForbidden,
    WorkflowApprovalNotFound,
    WorkflowCancellationConflict,
    WorkflowDispatchLost,
    WorkflowNotFound,
    WorkflowRepository,
    WorkflowWaitingApproval,
)


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

    async def list_approvals(self, workflow_id: UUID, subject: str) -> list[WorkflowApproval]:
        async with self._lock:
            workflow = self.workflows.get(workflow_id)
            if workflow is None or workflow.owner_subject != subject:
                raise WorkflowNotFound
            approvals = [
                approval.model_copy(deep=True)
                for approval in self.approvals.values()
                if approval.workflow_id == workflow_id and approval.owner_subject == subject
            ]
            return sorted(approvals, key=lambda approval: (approval.requested_at, str(approval.id)), reverse=True)

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

    async def claim_event_dispatch(self, worker_id: str, lease_seconds: int) -> "WorkflowDispatch | None":
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
                # Local import to avoid a circular reference at module
                # load time (cache.py is imported by index.py).
                from .index import WorkflowDispatch

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
        dispatch: "WorkflowDispatch",
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
        dispatch: "WorkflowDispatch",
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
        dispatch: "WorkflowDispatch",
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
