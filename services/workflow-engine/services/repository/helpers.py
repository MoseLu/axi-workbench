"""Shared types and row/value helpers for the `services.repository` package.

This module exists so the mixin segments (`query.py`, `mutation.py`,
`cache.py`) and the main `index.py` can import their common building
blocks without forming a circular dependency. Anything that would
otherwise need to be imported at module load time by more than one
segment belongs here:

* The 8 exception types raised by the repository layer.
* The `WorkflowRepository` abstract base class.
* Row/value helpers that translate between Pydantic models and
  `psycopg` tuple rows / parameter tuples.

`index.py` re-exports the public names from here so existing
`from services.repository import X` imports keep working.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb

from models.workflow import (
    Workflow,
    WorkflowApproval,
    WorkflowApprovalStatus,
    WorkflowExecution,
    WorkflowStatus,
)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# WorkflowDispatch — leased event-to-workflow execution request
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkflowDispatch:
    """A leased event-to-workflow execution request."""

    event_id: str
    workflow_id: UUID
    owner_subject: str
    payload: Any
    attempts: int


# ---------------------------------------------------------------------------
# WorkflowRepository ABC
# ---------------------------------------------------------------------------

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
    async def list_approvals(self, workflow_id: UUID, subject: str) -> list[WorkflowApproval]:
        """Return the durable approval history for one workflow owned by the subject."""
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


# ---------------------------------------------------------------------------
# Row / value helpers
# ---------------------------------------------------------------------------

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
