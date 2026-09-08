"""Workflow execution service."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from models.workflow import (
    StepStatus,
    StepType,
    WorkflowApproval,
    WorkflowApprovalStatus,
    Workflow,
    WorkflowExecution,
    WorkflowStatus,
    WorkflowStep,
)
from services.http_client import HttpStepClient, HttpxStepClient
from services.agent_runtime import (
    BoundedAgentRuntime,
    BoundedAgentRuntimeError,
    UnavailableBoundedAgentRuntime,
    action_digest,
    decide_route,
    validate_bounded_decision,
)
from services.approved_effects import ApprovedEffectExecutor, DenyApprovedEffectExecutor

logger = logging.getLogger(__name__)


class ApprovalRequired(Exception):
    """Raised internally when a workflow must pause for a manual decision."""

    def __init__(self, approval: WorkflowApproval) -> None:
        super().__init__(approval.prompt)
        self.approval = approval


class WorkflowExecutor:
    """Service for executing workflow steps."""

    def __init__(
        self,
        step_timeout: int = 300,
        *,
        http_client: HttpStepClient | None = None,
        http_allowed_hosts: set[str] | frozenset[str] = frozenset(),
        allow_insecure_http: bool = False,
        max_http_response_bytes: int = 1024 * 1024,
        agent_runtime: BoundedAgentRuntime | None = None,
        approved_effect_executor: ApprovedEffectExecutor | None = None,
        bounded_agent_allowed_tools: set[str] | frozenset[str] = frozenset(
            {"swarm_git_status", "swarm_validate_with_gates"}
        ),
    ):
        self.step_timeout = max(0.1, float(step_timeout))
        self.http_client = http_client or HttpxStepClient(
            allowed_hosts=http_allowed_hosts,
            allow_insecure_http=allow_insecure_http,
            max_response_bytes=max_http_response_bytes,
        )
        self.agent_runtime = agent_runtime or UnavailableBoundedAgentRuntime()
        self.approved_effect_executor = approved_effect_executor or DenyApprovedEffectExecutor()
        self.bounded_agent_allowed_tools = frozenset(bounded_agent_allowed_tools)

    async def execute_workflow(self, workflow: Workflow, event_payload: Any = None) -> WorkflowExecution:
        """Execute all steps in a workflow."""
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.RUNNING,
            started_at=datetime.now(UTC),
            steps=[step.model_copy(deep=True) for step in workflow.steps],
        )

        context: dict[str, Any] = {
            "_routing_decisions": execution.routing_decisions,
            "_lifecycle_events": execution.lifecycle_events,
            "_approval_grants": {},
        }
        if event_payload is not None:
            context["event"] = event_payload

        return await self._run_steps(execution, context, 0)

    async def resume_workflow(
        self,
        workflow: Workflow,
        execution: WorkflowExecution,
        approval: WorkflowApproval,
    ) -> WorkflowExecution:
        """Resume a paused workflow after an atomic approval decision."""
        if execution.status != WorkflowStatus.WAITING_APPROVAL or execution.pending_approval is None:
            raise ValueError("workflow has no pending approval")
        if execution.pending_approval.id != approval.id or approval.workflow_id != workflow.id:
            raise ValueError("approval does not belong to the pending workflow execution")
        context = dict(execution.result or {})
        context.setdefault("_routing_decisions", execution.routing_decisions)
        context.setdefault("_lifecycle_events", execution.lifecycle_events)
        context.setdefault("_approval_grants", {})
        pending_index = next(
            (index for index, step in enumerate(execution.steps) if step.id == approval.step_id),
            None,
        )
        if pending_index is None:
            raise ValueError("approval step is not present in the workflow execution")
        pending_step = execution.steps[pending_index]
        execution.pending_approval = None
        if approval.status == WorkflowApprovalStatus.REJECTED:
            pending_step.status = StepStatus.FAILED
            pending_step.error = approval.decision_comment or "workflow approval was rejected"
            execution.status = WorkflowStatus.FAILED
            execution.error = pending_step.error
            execution.result = context
            execution.completed_at = datetime.now(UTC)
            return execution

        if pending_step.step_type == StepType.APPROVED_EFFECT:
            if not approval.action_digest:
                raise ValueError("approved effect approval is missing its action digest")
            grant = {
                "grantId": str(uuid4()),
                "approvalId": str(approval.id),
                "actionDigest": approval.action_digest,
                "permissions": approval.grant_permissions,
                "expiresAt": (datetime.now(UTC) + timedelta(minutes=5)).isoformat(),
                "usedAt": None,
            }
            context.setdefault("_approval_grants", {})[str(pending_step.id)] = grant
            pending_step.status = StepStatus.PENDING
            self._record_lifecycle_event(
                context,
                event_type="approval_resumed",
                producer="workflow-engine",
                trace_id=self._trace_id_for_context(context),
                idempotency_key=self._idempotency_key_for_context(context),
                payload={"approvalId": str(approval.id), "actionDigest": approval.action_digest},
            )
            return await self._run_steps(execution, context, pending_index)

        pending_step.status = StepStatus.COMPLETED
        pending_step.result = {
            "approvalId": str(approval.id),
            "approved": True,
            "decidedBy": approval.decided_by,
            "comment": approval.decision_comment,
        }
        context[pending_step.name] = pending_step.result
        return await self._run_steps(execution, context, pending_index + 1)

    async def _run_steps(
        self,
        execution: WorkflowExecution,
        context: dict[str, Any],
        start_index: int,
    ) -> WorkflowExecution:
        """Run the remaining steps and converge the execution state."""

        for step in execution.steps[start_index:]:
            try:
                result = await asyncio.wait_for(
                    self._execute_step(step, context, execution.workflow_id), timeout=self.step_timeout
                )
                step.status = StepStatus.COMPLETED
                step.result = result
                context[step.name] = result
            except ApprovalRequired as exc:
                step.status = StepStatus.WAITING
                step.error = None
                execution.status = WorkflowStatus.WAITING_APPROVAL
                execution.pending_approval = exc.approval
                execution.result = context
                execution.completed_at = None
                return execution
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

    async def _execute_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        workflow_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Execute a single workflow step."""
        step.status = StepStatus.RUNNING

        match step.step_type:
            case StepType.TASK:
                return await self._execute_task(step, context)
            case StepType.CONDITION:
                return await self._execute_condition(step, context)
            case StepType.DELAY:
                return await self._execute_delay(step, context)
            case StepType.PARALLEL:
                return await self._execute_parallel(step, context)
            case StepType.HTTP:
                return await self._execute_http(step, context)
            case StepType.APPROVAL:
                if workflow_id is None:
                    raise ValueError("approval step requires a workflow execution")
                return await self._execute_approval(step, workflow_id)
            case StepType.BOUNDED_AGENT:
                if workflow_id is None:
                    raise ValueError("bounded Agent step requires a workflow execution")
                return await self._execute_bounded_agent(step, context, workflow_id)
            case StepType.APPROVED_EFFECT:
                if workflow_id is None:
                    raise ValueError("approved effect step requires a workflow execution")
                return await self._execute_approved_effect(step, context, workflow_id)
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

    async def _execute_http(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Call an allowlisted external task endpoint with a bounded response."""
        url = step.config.get("url")
        if not isinstance(url, str) or not url.strip():
            raise ValueError("HTTP step requires a URL")
        method = step.config.get("method", "POST")
        if not isinstance(method, str):
            raise ValueError("HTTP step method must be a string")
        raw_headers = step.config.get("headers", {})
        if not isinstance(raw_headers, dict) or any(
            not isinstance(key, str) or not isinstance(value, str) for key, value in raw_headers.items()
        ):
            raise ValueError("HTTP step headers must be a string map")
        if len(raw_headers) > 32:
            raise ValueError("HTTP step cannot send more than 32 headers")
        body = step.config.get("body", step.config.get("payload"))
        timeout_seconds = step.config.get("timeoutSeconds", self.step_timeout)
        try:
            timeout_seconds = float(timeout_seconds)
        except (TypeError, ValueError) as exc:
            raise ValueError("HTTP step timeoutSeconds must be a number") from exc
        if timeout_seconds <= 0 or timeout_seconds > self.step_timeout:
            raise ValueError("HTTP step timeoutSeconds must be greater than 0 and no greater than the workflow step timeout")

        response = await self.http_client.request(
            method=method,
            url=url,
            headers=raw_headers,
            body=body,
            timeout_seconds=timeout_seconds,
        )
        status_code = response.get("statusCode")
        expected = step.config.get("expectedStatus")
        if expected is None:
            accepted = isinstance(status_code, int) and 200 <= status_code < 300
        elif isinstance(expected, int) and not isinstance(expected, bool):
            accepted = status_code == expected
        elif isinstance(expected, list) and all(isinstance(item, int) and not isinstance(item, bool) for item in expected):
            accepted = status_code in expected
        else:
            raise ValueError("HTTP step expectedStatus must be an integer or an array of integers")
        if not accepted:
            raise ValueError(f"HTTP step returned unexpected status: {status_code}")
        return {
            "method": method.upper().strip(),
            "statusCode": status_code,
            "response": response,
        }

    async def _execute_approval(self, step: WorkflowStep, workflow_id: UUID) -> dict[str, Any]:
        """Pause execution and emit a durable approval request."""
        raw_approvers = step.config.get("approvers", [])
        if not isinstance(raw_approvers, list) or any(not isinstance(item, str) or not item.strip() for item in raw_approvers):
            raise ValueError("approval approvers must be an array of non-empty subjects")
        prompt = step.config.get("prompt", f"Approval required for workflow step {step.name}")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("approval prompt must be a non-empty string")
        raise ApprovalRequired(
            WorkflowApproval(
                workflow_id=workflow_id,
                step_id=step.id,
                step_name=step.name,
                prompt=prompt.strip(),
                approvers=sorted(set(item.strip() for item in raw_approvers)),
            )
        )

    async def _execute_bounded_agent(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        workflow_id: UUID,
    ) -> dict[str, Any]:
        """Run a typed, read-only Agent operation under a workflow-issued route."""
        routing = step.config.get("routing", {})
        decision = decide_route(routing, workflow_id=str(workflow_id), step_id=str(step.id))
        context.setdefault("_routing_decisions", {})[str(step.id)] = decision
        self._record_lifecycle_event(
            context,
            event_type="started",
            producer="workflow-engine",
            trace_id=decision["traceId"],
            idempotency_key=decision["idempotencyKey"],
            payload={"stepId": str(step.id), "route": decision["route"]},
        )

        if decision["route"] != "bounded_agent":
            prompt = step.config.get("escalationPrompt", "Workflow routing requires human review before Agent execution.")
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError("bounded Agent escalationPrompt must be a non-empty string")
            raise ApprovalRequired(
                WorkflowApproval(
                    workflow_id=workflow_id,
                    step_id=step.id,
                    step_name=step.name,
                    prompt=prompt.strip(),
                    approvers=self._approvers(step),
                )
            )

        try:
            validate_bounded_decision(decision, allowed_tools=set(self.bounded_agent_allowed_tools))
            request = step.config.get("request", {})
            if not isinstance(request, dict):
                raise BoundedAgentRuntimeError("bounded Agent request must be an object")
            result = await self.agent_runtime.run(decision=decision, request=request)
        except BoundedAgentRuntimeError as exc:
            self._record_lifecycle_event(
                context,
                event_type="failed",
                producer="workflow-engine",
                trace_id=decision["traceId"],
                idempotency_key=decision["idempotencyKey"],
                payload={"stepId": str(step.id), "reasonCode": str(exc)},
            )
            raise

        self._record_lifecycle_event(
            context,
            event_type="result",
            producer="agent-platform",
            trace_id=decision["traceId"],
            idempotency_key=decision["idempotencyKey"],
            payload={"stepId": str(step.id), "status": result.get("status", "succeeded")},
        )
        return {"routeDecision": decision, "agentResult": result}

    async def _execute_approved_effect(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        workflow_id: UUID,
    ) -> dict[str, Any]:
        """Execute one digest-bound effect only after a durable approval grant."""
        proposal_path = step.config.get("proposalFrom")
        if not isinstance(proposal_path, str) or not proposal_path.strip():
            raise ValueError("approved effect step requires proposalFrom")
        exists, proposal = _resolve_path(context, proposal_path)
        if not exists or not isinstance(proposal, dict):
            raise ValueError("approved effect proposal was not found in workflow context")
        action = proposal.get("action")
        digest = proposal.get("actionDigest")
        if not isinstance(action, dict) or not isinstance(digest, str) or digest != action_digest(action):
            raise ValueError("approved effect proposal action digest is invalid")
        kind = action.get("kind")
        if not isinstance(kind, str) or not kind:
            raise ValueError("approved effect action kind is required")
        permissions = step.config.get("permissions", [f"effect:{kind}"])
        if not isinstance(permissions, list) or any(not isinstance(item, str) or not item for item in permissions):
            raise ValueError("approved effect permissions must be a non-empty string list")

        grant = context.setdefault("_approval_grants", {}).get(str(step.id))
        if grant is None:
            prompt = step.config.get("prompt", f"Approve {kind} effect for workflow step {step.name}")
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError("approved effect prompt must be a non-empty string")
            raise ApprovalRequired(
                WorkflowApproval(
                    workflow_id=workflow_id,
                    step_id=step.id,
                    step_name=step.name,
                    prompt=prompt.strip(),
                    approvers=self._approvers(step),
                    action_digest=digest,
                    effect_action=action,
                    grant_permissions=permissions,
                )
            )
        if grant.get("actionDigest") != digest or grant.get("permissions") != permissions:
            raise PermissionError("approval grant does not match the requested effect")
        if grant.get("usedAt"):
            raise PermissionError("approval grant has already been used")
        try:
            expires_at = datetime.fromisoformat(str(grant.get("expiresAt", "")).replace("Z", "+00:00"))
        except ValueError as exc:
            raise PermissionError("approval grant expiry is invalid") from exc
        if expires_at <= datetime.now(UTC):
            raise PermissionError("approval grant has expired")

        result = await self.approved_effect_executor.execute(action=action, grant=grant)
        grant["usedAt"] = datetime.now(UTC).isoformat()
        self._record_lifecycle_event(
            context,
            event_type="result",
            producer="workflow-engine",
            trace_id=self._trace_id_for_context(context),
            idempotency_key=self._idempotency_key_for_context(context),
            payload={"stepId": str(step.id), "actionDigest": digest, "grantId": grant["grantId"]},
        )
        return {"actionDigest": digest, "grantId": grant["grantId"], "effectResult": result}

    @staticmethod
    def _approvers(step: WorkflowStep) -> list[str]:
        raw_approvers = step.config.get("approvers", [])
        if not isinstance(raw_approvers, list) or any(not isinstance(item, str) or not item.strip() for item in raw_approvers):
            raise ValueError("approval approvers must be an array of non-empty subjects")
        return sorted(set(item.strip() for item in raw_approvers))

    @staticmethod
    def _record_lifecycle_event(
        context: dict[str, Any],
        *,
        event_type: str,
        producer: str,
        trace_id: str,
        idempotency_key: str,
        payload: dict[str, Any],
    ) -> None:
        context.setdefault("_lifecycle_events", []).append(
            {
                "schemaVersion": "task-execution-routing/v1",
                "eventType": event_type,
                "eventId": str(uuid4()),
                "producer": producer,
                "traceId": trace_id,
                "idempotencyKey": idempotency_key,
                "occurredAt": datetime.now(UTC).isoformat(),
                "payload": payload,
            }
        )

    @staticmethod
    def _trace_id_for_context(context: dict[str, Any]) -> str:
        decisions = context.get("_routing_decisions", {})
        if isinstance(decisions, dict):
            for decision in decisions.values():
                if isinstance(decision, dict) and isinstance(decision.get("traceId"), str):
                    return decision["traceId"]
        return "workflow-approval"

    @staticmethod
    def _idempotency_key_for_context(context: dict[str, Any]) -> str:
        decisions = context.get("_routing_decisions", {})
        if isinstance(decisions, dict):
            for decision in decisions.values():
                if isinstance(decision, dict) and isinstance(decision.get("idempotencyKey"), str):
                    return decision["idempotencyKey"]
        return "workflow-approval"

    async def _execute_parallel(self, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        """Execute independent child steps with a bounded worker pool.

        Child steps share a read-only snapshot of the current context. Their
        outputs are returned under their names and are not written back into
        sibling context, which avoids order-dependent races.
        """
        raw_steps = step.config.get("steps", [])
        if not isinstance(raw_steps, list):
            raise ValueError("parallel steps must be an array")
        if len(raw_steps) > 64:
            raise ValueError("parallel steps cannot contain more than 64 children")

        children: list[WorkflowStep] = []
        names: set[str] = set()
        for index, raw_step in enumerate(raw_steps):
            if not isinstance(raw_step, dict):
                raise ValueError(f"parallel child {index} must be an object")
            name = str(raw_step.get("name", "")).strip()
            if not name:
                raise ValueError(f"parallel child {index} requires a name")
            if name in names:
                raise ValueError(f"parallel child name is duplicated: {name}")
            names.add(name)
            step_type_value = raw_step.get(
                "stepType", raw_step.get("step_type", raw_step.get("type", "task"))
            )
            try:
                step_type = StepType(step_type_value)
            except ValueError as exc:
                raise ValueError(f"parallel child {name} has an unknown step type") from exc
            if step_type is StepType.PARALLEL:
                raise ValueError("nested parallel steps are not supported")
            if step_type in {StepType.APPROVAL, StepType.BOUNDED_AGENT, StepType.APPROVED_EFFECT}:
                raise ValueError("approval, bounded Agent, and approved effect steps are not supported inside parallel groups")
            child_config = raw_step.get("config", {})
            if not isinstance(child_config, dict):
                raise ValueError(f"parallel child {name} config must be an object")
            children.append(WorkflowStep(name=name, step_type=step_type, config=child_config))

        if not children:
            return {"completed": True, "steps": {}}

        configured_limit = step.config.get("maxConcurrency", len(children))
        if isinstance(configured_limit, bool):
            raise ValueError("parallel maxConcurrency must be a positive integer")
        try:
            max_concurrency = int(configured_limit)
        except (TypeError, ValueError) as exc:
            raise ValueError("parallel maxConcurrency must be a positive integer") from exc
        if max_concurrency < 1:
            raise ValueError("parallel maxConcurrency must be a positive integer")
        semaphore = asyncio.Semaphore(min(max_concurrency, len(children)))

        async def run_child(child: WorkflowStep) -> tuple[str, dict[str, Any]]:
            async with semaphore:
                result = await asyncio.wait_for(
                    self._execute_step(child, context), timeout=self.step_timeout
                )
                return child.name, {"status": child.status.value, "result": result}

        tasks = [asyncio.create_task(run_child(child)) for child in children]
        try:
            results = await asyncio.gather(*tasks)
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

        return {"completed": True, "steps": dict(results)}


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
