import asyncio
from typing import Any

from models.workflow import (
    StepType,
    Workflow,
    WorkflowApprovalStatus,
    WorkflowStep,
    WorkflowStatus,
)
from services.executor import ConditionEvaluationError, WorkflowExecutor, evaluate_condition


class FakeHTTPClient:
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    async def request(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return self.response


def test_executor_evaluates_structured_conditions_against_event_and_step_context() -> None:
    async def scenario() -> None:
        workflow = Workflow(
            name="condition workflow",
            steps=[
                WorkflowStep(
                    name="event-ready",
                    step_type=StepType.CONDITION,
                    config={"condition": {"path": "event.status", "equals": "ready"}},
                ),
                WorkflowStep(
                    name="compound",
                    step_type=StepType.CONDITION,
                    config={
                        "condition": {
                            "all": [
                                {"path": "event.count", "gte": 2},
                                {"path": "event.missing", "exists": False},
                                {"path": "event.tags", "contains": "urgent"},
                            ]
                        }
                    },
                ),
            ],
        )

        execution = await WorkflowExecutor(step_timeout=1).execute_workflow(
            workflow,
            {"status": "ready", "count": 2, "tags": ["urgent"]},
        )

        assert execution.status == WorkflowStatus.COMPLETED
        assert execution.steps[0].result["result"] is True
        assert execution.steps[1].result["result"] is True

    asyncio.run(scenario())


def test_condition_language_rejects_unstructured_expression() -> None:
    try:
        evaluate_condition("event.status == ready", {"event": {"status": "ready"}})
    except ConditionEvaluationError as exc:
        assert "true or false" in str(exc)
    else:
        raise AssertionError("unsafe expression was accepted")


def test_executor_fails_step_that_exceeds_timeout() -> None:
    async def scenario() -> None:
        workflow = Workflow(
            name="timeout workflow",
            steps=[WorkflowStep(name="slow", step_type=StepType.DELAY, config={"seconds": 0.2})],
        )
        execution = await WorkflowExecutor(step_timeout=0.1).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.FAILED
        assert execution.steps[0].status.value == "failed"
        assert "timeout" in (execution.error or "")

    asyncio.run(scenario())


def test_executor_runs_bounded_parallel_children() -> None:
    async def scenario() -> None:
        workflow = Workflow(
            name="parallel workflow",
            steps=[
                WorkflowStep(
                    name="fan-out",
                    step_type=StepType.PARALLEL,
                    config={
                        "maxConcurrency": 2,
                        "steps": [
                            {"name": "first", "type": "condition", "config": {"condition": True}},
                            {"name": "second", "type": "delay", "config": {"seconds": 0.01}},
                            {"name": "third", "stepType": "condition", "config": {"condition": False}},
                        ],
                    },
                )
            ],
        )

        execution = await WorkflowExecutor(step_timeout=1).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.COMPLETED
        result = execution.steps[0].result
        assert result["completed"] is True
        assert result["steps"]["first"]["result"]["result"] is True
        assert result["steps"]["third"]["result"]["result"] is False

    asyncio.run(scenario())


def test_executor_rejects_duplicate_parallel_child_names() -> None:
    async def scenario() -> None:
        workflow = Workflow(
            name="invalid parallel workflow",
            steps=[
                WorkflowStep(
                    name="fan-out",
                    step_type=StepType.PARALLEL,
                    config={
                        "steps": [
                            {"name": "same", "type": "condition", "config": {"condition": True}},
                            {"name": "same", "type": "condition", "config": {"condition": True}},
                        ]
                    },
                )
            ],
        )

        execution = await WorkflowExecutor(step_timeout=1).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.FAILED
        assert "duplicated" in (execution.error or "")

    asyncio.run(scenario())


def test_executor_runs_allowlisted_http_task_with_bounded_contract() -> None:
    async def scenario() -> None:
        client = FakeHTTPClient(
            {
                "statusCode": 202,
                "headers": {"content-type": "application/json"},
                "body": {"accepted": True},
            }
        )
        workflow = Workflow(
            name="http workflow",
            steps=[
                WorkflowStep(
                    name="notify-external",
                    step_type=StepType.HTTP,
                    config={
                        "url": "https://hooks.example.com/jobs",
                        "method": "POST",
                        "headers": {"x-request-kind": "workflow"},
                        "body": {"event": "created"},
                        "expectedStatus": [200, 202],
                    },
                )
            ],
        )

        execution = await WorkflowExecutor(
            step_timeout=1,
            http_client=client,
        ).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.COMPLETED
        assert execution.steps[0].result["statusCode"] == 202
        assert client.calls[0]["url"] == "https://hooks.example.com/jobs"

    asyncio.run(scenario())


def test_executor_rejects_http_task_without_matching_policy() -> None:
    async def scenario() -> None:
        workflow = Workflow(
            name="blocked http workflow",
            steps=[
                WorkflowStep(
                    name="blocked",
                    step_type=StepType.HTTP,
                    config={"url": "https://not-allowlisted.example/jobs"},
                )
            ],
        )

        execution = await WorkflowExecutor(step_timeout=1).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.FAILED
        assert "allowlisted" in (execution.error or "")

    asyncio.run(scenario())


def test_executor_pauses_and_resumes_approval_step() -> None:
    async def scenario() -> None:
        workflow = Workflow(
            name="approval workflow",
            steps=[
                WorkflowStep(
                    name="release-approval",
                    step_type=StepType.APPROVAL,
                    config={"prompt": "Approve release", "approvers": ["alice"]},
                ),
                WorkflowStep(name="release", step_type=StepType.TASK, config={"action": "release"}),
            ],
        )
        executor = WorkflowExecutor(step_timeout=1)
        waiting = await executor.execute_workflow(workflow)

        assert waiting.status == WorkflowStatus.WAITING_APPROVAL
        assert waiting.pending_approval is not None
        assert waiting.steps[0].status.value == "waiting"

        approval = waiting.pending_approval.model_copy(
            update={
                "status": WorkflowApprovalStatus.APPROVED,
                "decided_by": "alice",
                "decision_comment": "ship it",
            }
        )
        resumed = await executor.resume_workflow(workflow, waiting, approval)

        assert resumed.status == WorkflowStatus.COMPLETED
        assert resumed.pending_approval is None
        assert resumed.steps[0].result["approved"] is True
        assert resumed.steps[1].result["action"] == "release"

    asyncio.run(scenario())
