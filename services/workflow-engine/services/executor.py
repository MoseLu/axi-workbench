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
        self.step_timeout = step_timeout

    async def execute_workflow(self, workflow: Workflow, event_payload: Any = None) -> WorkflowExecution:
        """Execute all steps in a workflow."""
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.RUNNING,
            started_at=datetime.now(UTC),
            steps=workflow.steps.copy(),
        )

        context: dict[str, Any] = {}
        if event_payload is not None:
            context["event"] = event_payload

        for step in execution.steps:
            try:
                result = await self._execute_step(step, context)
                step.status = StepStatus.COMPLETED
                step.result = result
                context[step.name] = result
            except Exception as e:
                logger.error(f"Step {step.name} failed: {e}")
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
        condition = step.config.get("condition", "true")
        logger.info(f"Evaluating condition: {condition}")

        # Simple condition evaluation for demo
        result = condition.lower() == "true"

        return {
            "condition": condition,
            "result": result,
            "branch": "true" if result else "false",
        }

    async def _execute_delay(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a delay step."""
        delay_seconds = step.config.get("seconds", 1)
        logger.info(f"Delaying for {delay_seconds} seconds")

        await asyncio.sleep(min(delay_seconds, self.step_timeout))

        return {
            "delayed_seconds": delay_seconds,
            "completed": True,
        }
