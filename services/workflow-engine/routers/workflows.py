"""Workflow CRUD endpoints."""

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from config import get_settings
from models.workflow import (
    Workflow,
    WorkflowCreate,
    WorkflowExecution,
    WorkflowStatus,
    WorkflowUpdate,
)
from services.executor import WorkflowExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])

# In-memory storage (replace with database in production)
workflows_db: dict[UUID, Workflow] = {}
executing_workflows: dict[UUID, WorkflowExecution] = {}

settings = get_settings()
executor = WorkflowExecutor(step_timeout=settings.step_timeout_seconds)


@router.get("", response_model=list[Workflow])
async def list_workflows() -> list[Workflow]:
    """List all workflows."""
    return list(workflows_db.values())


@router.post("", response_model=Workflow, status_code=status.HTTP_201_CREATED)
async def create_workflow(workflow_data: WorkflowCreate) -> Workflow:
    """Create a new workflow."""
    workflow = Workflow(
        name=workflow_data.name,
        description=workflow_data.description,
        steps=workflow_data.steps,
    )
    workflows_db[workflow.id] = workflow
    logger.info(f"Created workflow: {workflow.id} - {workflow.name}")
    return workflow


@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(workflow_id: UUID) -> Workflow:
    """Get a workflow by ID."""
    if workflow_id not in workflows_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )
    return workflows_db[workflow_id]


@router.patch("/{workflow_id}", response_model=Workflow)
async def update_workflow(workflow_id: UUID, workflow_data: WorkflowUpdate) -> Workflow:
    """Update a workflow."""
    if workflow_id not in workflows_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    workflow = workflows_db[workflow_id]

    if workflow_data.name is not None:
        workflow.name = workflow_data.name
    if workflow_data.description is not None:
        workflow.description = workflow_data.description
    if workflow_data.steps is not None:
        workflow.steps = workflow_data.steps

    workflow.updated_at = datetime.utcnow()
    workflows_db[workflow_id] = workflow

    return workflow


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: UUID) -> None:
    """Delete a workflow."""
    if workflow_id not in workflows_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )
    del workflows_db[workflow_id]
    logger.info(f"Deleted workflow: {workflow_id}")


@router.post("/{workflow_id}/execute", response_model=WorkflowExecution)
async def execute_workflow(workflow_id: UUID) -> WorkflowExecution:
    """Execute a workflow."""
    if workflow_id not in workflows_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    workflow = workflows_db[workflow_id]

    if workflow.status == WorkflowStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow {workflow_id} is already running",
        )

    workflow.status = WorkflowStatus.RUNNING
    workflow.executed_at = datetime.utcnow()
    workflows_db[workflow_id] = workflow

    logger.info(f"Starting execution of workflow: {workflow_id}")

    execution = await executor.execute_workflow(workflow)

    # Update workflow with execution results
    workflow.status = execution.status
    workflow.result = execution.result
    workflow.updated_at = datetime.utcnow()
    workflows_db[workflow_id] = workflow

    executing_workflows[workflow_id] = execution

    return execution


@router.get("/{workflow_id}/execution", response_model=WorkflowExecution)
async def get_workflow_execution(workflow_id: UUID) -> WorkflowExecution:
    """Get the execution result of a workflow."""
    if workflow_id not in executing_workflows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No execution found for workflow {workflow_id}",
        )
    return executing_workflows[workflow_id]
