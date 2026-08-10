"""Workflow CRUD and execution endpoints."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from config import get_settings
from models.workflow import (
    ApprovalDecisionRequest,
    Workflow,
    WorkflowApprovalStatus,
    WorkflowCreate,
    WorkflowExecution,
    WorkflowStatus,
    WorkflowUpdate,
)
from security import require_gateway_identity
from services.executor import WorkflowExecutor
from services.agent_runtime import HttpBoundedAgentRuntime, UnavailableBoundedAgentRuntime
from services.repository import (
    MemoryWorkflowRepository,
    WorkflowAlreadyRunning,
    WorkflowApprovalConflict,
    WorkflowApprovalForbidden,
    WorkflowApprovalNotFound,
    WorkflowCancellationConflict,
    WorkflowNotFound,
    WorkflowRepository,
    WorkflowWaitingApproval,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
    dependencies=[Depends(require_gateway_identity)],
)

_memory_repository = MemoryWorkflowRepository()
repository: WorkflowRepository = _memory_repository
# Compatibility names for the original development tests and local tooling.
# Production requests use the repository interface above, not these maps.
workflows_db = _memory_repository.workflows
executing_workflows = _memory_repository.executions


def _parse_http_allowed_hosts(value: str) -> frozenset[str]:
    return frozenset(item.strip().lower() for item in value.split(",") if item.strip())


def _build_bounded_agent_runtime(settings):
    if (
        settings.agent_platform_url.strip()
        and settings.agent_route_credential_secret
        and settings.agent_internal_event_token
    ):
        return HttpBoundedAgentRuntime(
            base_url=settings.agent_platform_url,
            route_credential_secret=settings.agent_route_credential_secret,
            internal_event_token=settings.agent_internal_event_token,
            timeout_seconds=settings.agent_timeout_seconds,
        )
    return UnavailableBoundedAgentRuntime()


_settings = get_settings()
executor = WorkflowExecutor(
    step_timeout=_settings.step_timeout_seconds,
    http_allowed_hosts=_parse_http_allowed_hosts(_settings.http_allowed_hosts),
    allow_insecure_http=_settings.environment.lower() != "production",
    max_http_response_bytes=_settings.http_max_response_bytes,
    agent_runtime=_build_bounded_agent_runtime(_settings),
    bounded_agent_allowed_tools=frozenset(
        item.strip() for item in _settings.agent_readonly_tools.split(",") if item.strip()
    ),
)


def set_repository(value: WorkflowRepository) -> None:
    global repository, workflows_db, executing_workflows
    repository = value
    if isinstance(value, MemoryWorkflowRepository):
        workflows_db = value.workflows
        executing_workflows = value.executions


def get_repository() -> WorkflowRepository:
    return repository


def get_executor() -> WorkflowExecutor:
    return executor


def set_executor(value: WorkflowExecutor) -> None:
    global executor
    executor = value


def _not_found(workflow_id: UUID, detail: str | None = None) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=detail or f"Workflow {workflow_id} not found",
    )


@router.get("", response_model=list[Workflow])
async def list_workflows(subject: str = Depends(require_gateway_identity)) -> list[Workflow]:
    """List only workflows owned by the verified subject."""
    return await repository.list(subject)


@router.post("", response_model=Workflow, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow_data: WorkflowCreate,
    subject: str = Depends(require_gateway_identity),
) -> Workflow:
    """Create a durable workflow definition."""
    workflow = Workflow(
        name=workflow_data.name,
        description=workflow_data.description,
        trigger_topic=workflow_data.trigger_topic,
        steps=workflow_data.steps,
        owner_subject=subject,
    )
    created = await repository.create(workflow)
    logger.info("Created workflow: %s - %s", created.id, created.name)
    return created


@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: UUID,
    subject: str = Depends(require_gateway_identity),
) -> Workflow:
    """Get an owned workflow by ID."""
    try:
        return await repository.get(workflow_id, subject)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc


@router.patch("/{workflow_id}", response_model=Workflow)
@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: UUID,
    workflow_data: WorkflowUpdate,
    subject: str = Depends(require_gateway_identity),
) -> Workflow:
    """Update an owned workflow definition."""
    try:
        workflow = await repository.get(workflow_id, subject)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc

    if workflow_data.name is not None:
        workflow.name = workflow_data.name
    if workflow_data.description is not None:
        workflow.description = workflow_data.description
    if workflow_data.trigger_topic is not None:
        workflow.trigger_topic = workflow_data.trigger_topic
    if workflow_data.steps is not None:
        workflow.steps = workflow_data.steps
    workflow.updated_at = datetime.now(UTC)

    try:
        return await repository.update(workflow, subject)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    subject: str = Depends(require_gateway_identity),
) -> None:
    """Delete an owned workflow and its execution record."""
    try:
        await repository.delete(workflow_id, subject)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc
    logger.info("Deleted workflow: %s", workflow_id)


@router.post("/{workflow_id}/execute", response_model=WorkflowExecution)
async def execute_workflow(
    workflow_id: UUID,
    subject: str = Depends(require_gateway_identity),
) -> WorkflowExecution:
    """Atomically claim and execute an owned workflow."""
    try:
        workflow = await repository.claim_for_execution(workflow_id, subject)
    except WorkflowAlreadyRunning as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow {workflow_id} is already running",
        ) from exc
    except WorkflowWaitingApproval as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow {workflow_id} is waiting for an approval decision",
        ) from exc
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc

    logger.info("Starting execution of workflow: %s", workflow_id)
    execution = await executor.execute_workflow(workflow)

    workflow.status = execution.status
    workflow.result = execution.result
    workflow.updated_at = datetime.now(UTC)
    try:
        await repository.update(workflow, subject)
        await repository.save_execution(execution, subject)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc
    return execution


@router.post("/{workflow_id}/approvals/{approval_id}", response_model=WorkflowExecution)
async def decide_workflow_approval(
    workflow_id: UUID,
    approval_id: UUID,
    request: ApprovalDecisionRequest,
    subject: str = Depends(require_gateway_identity),
) -> WorkflowExecution:
    """Atomically decide an approval and resume the remaining steps."""
    try:
        workflow, stored_execution, approval = await repository.approve_and_claim(
            approval_id,
            workflow_id,
            subject,
            WorkflowApprovalStatus(request.decision.value),
            request.comment,
        )
    except WorkflowApprovalNotFound as exc:
        raise _not_found(workflow_id, f"Approval {approval_id} not found") from exc
    except WorkflowApprovalForbidden as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="caller is not an allowed approver",
        ) from exc
    except WorkflowApprovalConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="approval has already been decided or workflow is not waiting",
        ) from exc

    execution = await executor.resume_workflow(workflow, stored_execution, approval)
    workflow.status = execution.status
    workflow.result = execution.result
    workflow.updated_at = datetime.now(UTC)
    try:
        await repository.update(workflow, workflow.owner_subject)
        await repository.save_execution(execution, workflow.owner_subject)
        if execution.status != WorkflowStatus.WAITING_APPROVAL:
            await repository.complete_waiting_dispatch(workflow_id, execution)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc
    return execution


@router.post("/{workflow_id}/cancel", response_model=WorkflowExecution)
async def cancel_workflow_execution(
    workflow_id: UUID,
    comment: str | None = None,
    subject: str = Depends(require_gateway_identity),
) -> WorkflowExecution:
    """Cancel a durable waiting execution before it can resume an approved effect."""
    try:
        execution = await repository.cancel_execution(workflow_id, subject, comment)
        decisions = execution.routing_decisions
        decision = next((item for item in decisions.values() if isinstance(item, dict)), None)
        if isinstance(decision, dict):
            lifecycle_event = {
                "schemaVersion": "task-execution-routing/v1",
                "eventType": "cancelled",
                "producer": "workflow-engine",
                "traceId": decision.get("traceId"),
                "idempotencyKey": decision.get("idempotencyKey"),
                "occurredAt": datetime.now(UTC).isoformat(),
                "payload": {"reasonCode": "workflow_cancelled"},
            }
            execution.lifecycle_events.append(lifecycle_event)
            if isinstance(execution.result, dict):
                execution.result.setdefault("_lifecycle_events", []).append(lifecycle_event)
        workflow = await repository.get(workflow_id, subject)
        workflow.result = execution.result
        workflow.updated_at = datetime.now(UTC)
        await repository.update(workflow, subject)
        await repository.save_execution(execution, subject)
        return execution
    except WorkflowCancellationConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="workflow is not waiting for a cancellable approval",
        ) from exc
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id) from exc


@router.get("/{workflow_id}/execution", response_model=WorkflowExecution)
async def get_workflow_execution(
    workflow_id: UUID,
    subject: str = Depends(require_gateway_identity),
) -> WorkflowExecution:
    """Get the latest durable execution result for an owned workflow."""
    try:
        return await repository.get_execution(workflow_id, subject)
    except WorkflowNotFound as exc:
        raise _not_found(workflow_id, f"No execution found for workflow {workflow_id}") from exc
