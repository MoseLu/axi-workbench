import asyncio

from models.workflow import StepType, Workflow, WorkflowStep, WorkflowStatus
from services.executor import ConditionEvaluationError, WorkflowExecutor, evaluate_condition


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
