import asyncio

from models.workflow import StepType, Workflow, WorkflowApprovalStatus, WorkflowStatus, WorkflowStep
from services.dispatch_worker import WorkflowDispatchWorker
from services.executor import WorkflowExecutor
from services.repository import MemoryWorkflowRepository


def test_dispatch_worker_executes_event_workflow_and_persists_outcome() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(name="on task", owner_subject="alice", trigger_topic="task.created")
        )
        assert await repository.consume_event(
            "event-worker-1",
            "tenant-1",
            "task.created",
            {"taskId": "task-1", "createdBy": "alice"},
            actor_subject="alice",
        )
        dispatch = await repository.claim_event_dispatch("worker-1", 60)
        assert dispatch is not None

        worker = WorkflowDispatchWorker(
            repository,
            WorkflowExecutor(step_timeout=1),
            worker_id="worker-1",
            retry_base_seconds=0,
        )
        await worker.process_dispatch(dispatch)

        stored = await repository.get(workflow.id, "alice")
        execution = await repository.get_execution(workflow.id, "alice")
        assert stored.status == WorkflowStatus.COMPLETED
        assert execution.result == {"event": {"taskId": "task-1", "createdBy": "alice"}}
        assert repository.event_dispatches[("event-worker-1", workflow.id)]["status"] == "completed"

    asyncio.run(scenario())


def test_dispatch_worker_retries_transient_executor_failure() -> None:
    class FlakyExecutor:
        def __init__(self) -> None:
            self.calls = 0
            self.delegate = WorkflowExecutor(step_timeout=1)

        async def execute_workflow(self, workflow: Workflow, event_payload: object = None):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("temporary executor failure")
            return await self.delegate.execute_workflow(workflow, event_payload=event_payload)

    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(name="retry task", owner_subject="alice", trigger_topic="task.created")
        )
        await repository.consume_event(
            "event-worker-2", "tenant-1", "task.created", {}, actor_subject="alice"
        )
        worker = WorkflowDispatchWorker(
            repository,
            FlakyExecutor(),
            worker_id="worker-2",
            retry_base_seconds=0,
            max_attempts=3,
        )
        first = await repository.claim_event_dispatch("worker-2", 60)
        assert first is not None
        await worker.process_dispatch(first)
        assert repository.event_dispatches[("event-worker-2", workflow.id)]["status"] == "pending"

        second = await repository.claim_event_dispatch("worker-2", 60)
        assert second is not None
        await worker.process_dispatch(second)
        assert repository.event_dispatches[("event-worker-2", workflow.id)]["status"] == "completed"
        assert second.attempts == 2

    asyncio.run(scenario())


def test_expired_dispatch_lease_recovers_running_workflow() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(name="recover task", owner_subject="alice", trigger_topic="task.created")
        )
        await repository.consume_event(
            "event-worker-3", "tenant-1", "task.created", {}, actor_subject="alice"
        )
        first = await repository.claim_event_dispatch("dead-worker", -1)
        assert first is not None
        await repository.claim_for_execution(workflow.id, "alice")

        recovered = await repository.claim_event_dispatch("worker-3", 60)
        assert recovered is not None
        assert recovered.attempts == 2
        interrupted = await repository.get(workflow.id, "alice")
        assert interrupted.status == WorkflowStatus.FAILED
        assert interrupted.result == {"error": "workflow dispatch lease expired"}

        worker = WorkflowDispatchWorker(
            repository,
            WorkflowExecutor(step_timeout=1),
            worker_id="worker-3",
        )
        await worker.process_dispatch(recovered)
        assert repository.event_dispatches[("event-worker-3", workflow.id)]["status"] == "completed"

    asyncio.run(scenario())


def test_recovery_keeps_another_worker_active_lease() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(name="active task", owner_subject="alice", trigger_topic="task.active")
        )
        await repository.consume_event(
            "event-worker-4", "tenant-1", "task.active", {}, actor_subject="alice"
        )
        active = await repository.claim_event_dispatch("active-worker", 60)
        assert active is not None
        await repository.claim_for_execution(workflow.id, "alice")

        assert await repository.recover_interrupted() == 0
        assert await repository.claim_event_dispatch("recovery-worker", 60) is None
        stored = await repository.get(workflow.id, "alice")
        assert stored.status == WorkflowStatus.RUNNING
        assert await repository.renew_event_dispatch(active, "active-worker", 60)

    asyncio.run(scenario())


def test_dispatch_worker_leaves_event_waiting_until_approval_resumes() -> None:
    async def scenario() -> None:
        repository = MemoryWorkflowRepository()
        workflow = await repository.create(
            Workflow(
                name="approval event",
                owner_subject="alice",
                trigger_topic="release.requested",
                steps=[
                    WorkflowStep(
                        name="approval",
                        step_type=StepType.APPROVAL,
                        config={"prompt": "Approve release", "approvers": ["alice"]},
                    ),
                    WorkflowStep(name="release", step_type=StepType.TASK),
                ],
            )
        )
        await repository.consume_event(
            "event-approval-1",
            "tenant-1",
            "release.requested",
            {"releaseId": "release-1"},
            actor_subject="alice",
        )
        dispatch = await repository.claim_event_dispatch("worker-approval", 60)
        assert dispatch is not None
        worker = WorkflowDispatchWorker(
            repository,
            WorkflowExecutor(step_timeout=1),
            worker_id="worker-approval",
        )
        await worker.process_dispatch(dispatch)

        assert repository.event_dispatches[("event-approval-1", workflow.id)]["status"] == "waiting"
        stored_execution = await repository.get_execution(workflow.id, "alice")
        assert stored_execution.pending_approval is not None

        resumed_workflow, pending_execution, approval = await repository.approve_and_claim(
            stored_execution.pending_approval.id,
            workflow.id,
            "alice",
            WorkflowApprovalStatus.APPROVED,
            "approved",
        )
        resumed = await WorkflowExecutor(step_timeout=1).resume_workflow(
            resumed_workflow,
            pending_execution,
            approval,
        )
        resumed_workflow.status = resumed.status
        resumed_workflow.result = resumed.result
        await repository.update(resumed_workflow, "alice")
        await repository.save_execution(resumed, "alice")
        await repository.complete_waiting_dispatch(workflow.id, resumed)

        assert resumed.status == WorkflowStatus.COMPLETED
        assert repository.event_dispatches[("event-approval-1", workflow.id)]["status"] == "completed"

    asyncio.run(scenario())
