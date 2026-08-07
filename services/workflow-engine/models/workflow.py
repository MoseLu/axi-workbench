"""Pydantic models for workflows."""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    WAITING_APPROVAL = "waiting_approval"


class StepStatus(str, Enum):
    """Step execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    WAITING = "waiting"


class StepType(str, Enum):
    """Type of workflow step."""
    TASK = "task"
    CONDITION = "condition"
    DELAY = "delay"
    PARALLEL = "parallel"
    HTTP = "http"
    APPROVAL = "approval"


class WorkflowApprovalStatus(str, Enum):
    """Lifecycle state of a durable manual approval request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ApprovalDecision(str, Enum):
    """Decision accepted by the approval endpoint."""

    APPROVED = "approved"
    REJECTED = "rejected"


class WorkflowStep(BaseModel):
    """A single step in a workflow."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    step_type: StepType = StepType.TASK
    config: dict[str, Any] = Field(default_factory=dict)
    status: StepStatus = StepStatus.PENDING
    result: dict[str, Any] | None = None
    error: str | None = None


class WorkflowCreate(BaseModel):
    """Request model for creating a workflow."""
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    trigger_topic: str | None = Field(default=None, alias="triggerTopic", max_length=128, pattern=r"^[a-z][a-z0-9_.-]*$")
    steps: list[WorkflowStep] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    """Request model for updating a workflow."""
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    description: str | None = None
    trigger_topic: str | None = Field(default=None, alias="triggerTopic", max_length=128, pattern=r"^[a-z][a-z0-9_.-]*$")
    steps: list[WorkflowStep] | None = None


class WorkflowApproval(BaseModel):
    """Durable approval request emitted by an approval workflow step."""

    model_config = ConfigDict(populate_by_name=True)

    id: UUID = Field(default_factory=uuid4)
    workflow_id: UUID = Field(..., alias="workflowId")
    step_id: UUID = Field(..., alias="stepId")
    owner_subject: str = Field(default="", exclude=True)
    step_name: str = Field(..., alias="stepName")
    prompt: str = Field(..., min_length=1, max_length=2000)
    approvers: list[str] = Field(default_factory=list, max_length=64)
    status: WorkflowApprovalStatus = WorkflowApprovalStatus.PENDING
    requested_at: datetime = Field(default_factory=lambda: datetime.now(UTC), alias="requestedAt")
    decided_at: datetime | None = Field(default=None, alias="decidedAt")
    decided_by: str | None = Field(default=None, alias="decidedBy")
    decision_comment: str | None = Field(default=None, alias="decisionComment")

    def can_be_decided_by(self, subject: str) -> bool:
        return subject == self.owner_subject or subject in self.approvers


class ApprovalDecisionRequest(BaseModel):
    """Request body for approving or rejecting a pending workflow step."""

    decision: ApprovalDecision
    comment: str | None = Field(default=None, max_length=2000)


class Workflow(BaseModel):
    """Workflow model with metadata."""
    model_config = ConfigDict(populate_by_name=True)

    id: UUID = Field(default_factory=uuid4)
    owner_subject: str = Field(default="", exclude=True)
    name: str
    description: str | None = None
    trigger_topic: str | None = Field(default=None, alias="triggerTopic")
    steps: list[WorkflowStep] = Field(default_factory=list)
    status: WorkflowStatus = WorkflowStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    executed_at: datetime | None = None
    result: dict[str, Any] | None = None


class WorkflowExecution(BaseModel):
    """Result of workflow execution."""

    model_config = ConfigDict(populate_by_name=True)

    workflow_id: UUID
    status: WorkflowStatus
    started_at: datetime
    completed_at: datetime | None = None
    steps: list[WorkflowStep]
    result: dict[str, Any] | None = None
    error: str | None = None
    pending_approval: WorkflowApproval | None = Field(default=None, alias="pendingApproval")
