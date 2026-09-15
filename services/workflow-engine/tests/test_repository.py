import asyncio
from datetime import UTC, datetime

import pytest

from models.workflow import Workflow, WorkflowApproval, WorkflowExecution, WorkflowStatus, WorkflowStep
from services.repository import MemoryWorkflowRepository, WorkflowAlreadyRunning, WorkflowNotFound


def test_memory_repository_enforces_owner_and_atomic_claim() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(Workflow(name="build", owner_subject="alice"))

        with pytest.raises(WorkflowNotFound):
            await repository.get(workflow.id, "bob")

        claimed = await repository.claim_for_execution(workflow.id, "alice")
        assert claimed.status == WorkflowStatus.RUNNING
        with pytest.raises(WorkflowAlreadyRunning):
            await repository.claim_for_execution(workflow.id, "alice")

        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.COMPLETED,
            started_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
            steps=[],
            result={"ok": True},
        )
        await repository.save_execution(execution, "alice")
        stored = await repository.get_execution(workflow.id, "alice")
        assert stored.result == {"ok": True}

    asyncio.run(scenario())


def test_memory_repository_recovers_interrupted_workflows() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(Workflow(name="build", owner_subject="alice"))
        await repository.claim_for_execution(workflow.id, "alice")

        assert await repository.recover_interrupted() == 1
        recovered = await repository.get(workflow.id, "alice")
        assert recovered.status == WorkflowStatus.FAILED
        assert recovered.result == {"error": "execution interrupted by service restart"}

    asyncio.run(scenario())


def test_memory_repository_deduplicates_platform_events() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        assert await repository.consume_event("event-1", "tenant-1", "task.created", {"id": "task-1"})
        assert not await repository.consume_event("event-1", "tenant-1", "task.created", {"id": "task-1"})
        assert list(repository.event_inbox) == ["event-1"]

    asyncio.run(scenario())


def test_memory_repository_persists_trigger_dispatch_for_event_owner() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(name="on task", owner_subject="alice", trigger_topic="task.created")
        )

        assert await repository.consume_event(
            "event-2", "tenant-1", "task.created", {"createdBy": "alice"}, actor_subject="alice"
        )
        assert ("event-2", workflow.id) in repository.event_dispatches
        assert not await repository.consume_event(
            "event-2", "tenant-1", "task.created", {"createdBy": "alice"}, actor_subject="alice"
        )
        assert len(repository.event_dispatches) == 1

    asyncio.run(scenario())


def test_memory_repository_preserves_approved_effect_metadata() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(name="approved effect", owner_subject="alice", steps=[WorkflowStep(name="publish proposal")])
        )
        await repository.claim_for_execution(workflow.id, "alice")
        action_digest = "a" * 64
        approval = WorkflowApproval(
            workflow_id=workflow.id,
            step_id=workflow.steps[0].id,
            step_name="publish proposal",
            prompt="Approve the exact proposed effect.",
            action_digest=action_digest,
            effect_action={"operation": "document_write", "documentId": "doc-1"},
            grant_permissions=["documents.write"],
        )
        await repository.save_execution(
            WorkflowExecution(
                workflow_id=workflow.id,
                status=WorkflowStatus.WAITING_APPROVAL,
                started_at=datetime.now(UTC),
                steps=[],
                pending_approval=approval,
            ),
            "alice",
        )

        stored = await repository.get_execution(workflow.id, "alice")
        assert stored.pending_approval is not None
        assert stored.pending_approval.action_digest == action_digest
        assert stored.pending_approval.effect_action == {"operation": "document_write", "documentId": "doc-1"}
        assert stored.pending_approval.grant_permissions == ["documents.write"]

        history = await repository.list_approvals(workflow.id, "alice")
        assert len(history) == 1
        assert history[0].effect_action == {"operation": "document_write", "documentId": "doc-1"}
        assert history[0].grant_permissions == ["documents.write"]

        with pytest.raises(WorkflowNotFound):
            await repository.list_approvals(workflow.id, "bob")

    asyncio.run(scenario())
