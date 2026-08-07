"""Pydantic models for workflows."""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    """Step execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class StepType(str, Enum):
    """Type of workflow step."""
    TASK = "task"
    CONDITION = "condition"
    DELAY = "delay"


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
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    steps: list[WorkflowStep] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    """Request model for updating a workflow."""
    name: str | None = None
    description: str | None = None
    steps: list[WorkflowStep] | None = None


class Workflow(BaseModel):
    """Workflow model with metadata."""
    id: UUID = Field(default_factory=uuid4)
    owner_subject: str = Field(default="", exclude=True)
    name: str
    description: str | None = None
    steps: list[WorkflowStep] = Field(default_factory=list)
    status: WorkflowStatus = WorkflowStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    executed_at: datetime | None = None
    result: dict[str, Any] | None = None


class WorkflowExecution(BaseModel):
    """Result of workflow execution."""
    workflow_id: UUID
    status: WorkflowStatus
    started_at: datetime
    completed_at: datetime | None = None
    steps: list[WorkflowStep]
    result: dict[str, Any] | None = None
    error: str | None = None
