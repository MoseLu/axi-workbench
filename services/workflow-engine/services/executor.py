"""Workflow execution service."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from models.workflow import (
    StepStatus,
    StepType,
    Workflow,
    WorkflowExecution,
    WorkflowStatus,
    WorkflowStep,
)

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """Service for executing workflow steps."""

    def __init__(self, step_timeout: int = 300):
        self.step_timeout = max(0.1, float(step_timeout))

    async def execute_workflow(self, workflow: Workflow, event_payload: Any = None) -> WorkflowExecution:
        """Execute all steps in a workflow."""
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.RUNNING,
            started_at=datetime.now(UTC),
            steps=[step.model_copy(deep=True) for step in workflow.steps],
        )

        context: dict[str, Any] = {}
        if event_payload is not None:
            context["event"] = event_payload

        for step in execution.steps:
            try:
                result = await asyncio.wait_for(
                    self._execute_step(step, context), timeout=self.step_timeout
                )
                step.status = StepStatus.COMPLETED
                step.result = result
                context[step.name] = result
            except asyncio.TimeoutError:
                error = f"step exceeded timeout of {self.step_timeout:g} seconds"
                logger.error("Step %s failed: %s", step.name, error)
                step.status = StepStatus.FAILED
                step.error = error
                execution.status = WorkflowStatus.FAILED
                execution.error = error
                execution.completed_at = datetime.now(UTC)
                return execution
            except Exception as e:
                logger.error("Step %s failed: %s", step.name, e)
                step.status = StepStatus.FAILED
                step.error = str(e)
                execution.status = WorkflowStatus.FAILED
                execution.error = str(e)
                execution.completed_at = datetime.now(UTC)
                return execution

        execution.status = WorkflowStatus.COMPLETED
        execution.result = context
        execution.completed_at = datetime.now(UTC)
        return execution

    async def _execute_step(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a single workflow step."""
        step.status = StepStatus.RUNNING

        match step.step_type:
            case StepType.TASK:
                return await self._execute_task(step, context)
            case StepType.CONDITION:
                return await self._execute_condition(step, context)
            case StepType.DELAY:
                return await self._execute_delay(step, context)
            case _:
                raise ValueError(f"Unknown step type: {step.step_type}")

    async def _execute_task(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a task step."""
        action = step.config.get("action", "noop")
        payload = step.config.get("payload", {})

        # Simulate task execution
        logger.info(f"Executing task: {step.name} with action: {action}")

        # For demo purposes, return a mock result
        await asyncio.sleep(0.1)

        return {
            "action": action,
            "executed": True,
            "input": payload,
            "output": {"status": "success", "message": f"Task {step.name} completed"},
        }

    async def _execute_condition(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a condition step."""
        condition = step.config.get("condition", True)
        logger.info("Evaluating condition: %r", condition)
        result = evaluate_condition(condition, context)

        return {
            "condition": condition,
            "result": result,
            "branch": "true" if result else "false",
        }

    async def _execute_delay(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a delay step."""
        delay_seconds = step.config.get("seconds", 1)
        try:
            delay_seconds = float(delay_seconds)
        except (TypeError, ValueError) as exc:
            raise ValueError("delay seconds must be a number") from exc
        if delay_seconds < 0:
            raise ValueError("delay seconds cannot be negative")
        logger.info("Delaying for %s seconds", delay_seconds)

        await asyncio.sleep(delay_seconds)

        return {
            "delayed_seconds": delay_seconds,
            "completed": True,
        }


class ConditionEvaluationError(ValueError):
    """The structured condition is not valid or cannot be evaluated."""


def evaluate_condition(expression: Any, context: dict[str, Any]) -> bool:
    """Evaluate a small, data-only condition language without ``eval``.

    Supported forms are ``true``/``false`` strings, boolean literals, and
    dictionaries such as ``{"path": "event.status", "equals": "ready"}``.
    Compound expressions use ``all``, ``any`` and ``not``. Paths only traverse
    dictionaries and list indexes from the execution context.
    """

    if isinstance(expression, bool):
        return expression
    if isinstance(expression, str):
        normalized = expression.strip().lower()
        if normalized == "true":
            return True
        if normalized == "false":
            return False
        raise ConditionEvaluationError("condition string must be true or false")
    if not isinstance(expression, dict):
        raise ConditionEvaluationError("condition must be a boolean, string, or object")

    if "all" in expression:
        values = expression["all"]
        if not isinstance(values, list):
            raise ConditionEvaluationError("all must be an array")
        return all(evaluate_condition(item, context) for item in values)
    if "any" in expression:
        values = expression["any"]
        if not isinstance(values, list):
            raise ConditionEvaluationError("any must be an array")
        return any(evaluate_condition(item, context) for item in values)
    if "not" in expression:
        return not evaluate_condition(expression["not"], context)

    path = expression.get("path")
    if not isinstance(path, str) or not path.strip():
        raise ConditionEvaluationError("condition path is required")
    exists, value = _resolve_path(context, path)
    if "exists" in expression:
        expected = expression["exists"]
        if not isinstance(expected, bool):
            raise ConditionEvaluationError("exists must be a boolean")
        return exists is expected
    if not exists:
        return False

    if "equals" in expression:
        return value == expression["equals"]
    if "notEquals" in expression:
        return value != expression["notEquals"]
    if "in" in expression:
        candidates = expression["in"]
        if not isinstance(candidates, list):
            raise ConditionEvaluationError("in must be an array")
        return value in candidates
    if "contains" in expression:
        needle = expression["contains"]
        if isinstance(value, (str, list, tuple, set, dict)):
            return needle in value
        return False
    for operator, comparator in (
        ("gt", lambda left, right: left > right),
        ("gte", lambda left, right: left >= right),
        ("lt", lambda left, right: left < right),
        ("lte", lambda left, right: left <= right),
    ):
        if operator in expression:
            try:
                return comparator(value, expression[operator])
            except TypeError as exc:
                raise ConditionEvaluationError(f"{operator} comparison is not supported") from exc
    if len(expression) == 1:
        return bool(value)
    raise ConditionEvaluationError("condition has no supported operator")


def _resolve_path(context: dict[str, Any], path: str) -> tuple[bool, Any]:
    normalized = path.strip()
    if normalized.startswith("$."):
        normalized = normalized[2:]
    elif normalized.startswith("$"):
        normalized = normalized[1:]
    parts = [part for part in normalized.split(".") if part]
    if not parts:
        return False, None

    value: Any = context
    for part in parts:
        if isinstance(value, dict) and part in value:
            value = value[part]
        elif isinstance(value, list) and part.isdigit() and int(part) < len(value):
            value = value[int(part)]
        else:
            return False, None
    return True, value
