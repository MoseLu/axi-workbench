import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from models.workflow import (
    StepType,
    Workflow,
    WorkflowApprovalStatus,
    WorkflowStep,
    WorkflowStatus,
)
from services.executor import ConditionEvaluationError, WorkflowExecutor, evaluate_condition
from services.agent_runtime import action_digest


class FakeHTTPClient:
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    async def request(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return self.response


class FakeBoundedAgentRuntime:
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    async def run(self, *, decision: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
        self.calls.append({"decision": decision, "request": request})
        return self.response


class FakeApprovedEffectExecutor:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def execute(self, *, action: dict[str, Any], grant: dict[str, Any]) -> dict[str, Any]:
        self.calls.append({"action": action, "grant": grant})
        return {"executed": True, "kind": action["kind"]}


def bounded_routing(**overrides: Any) -> dict[str, Any]:
    routing = {
        "localPathUnenumerable": True,
        "readOnly": True,
        "traceId": "trace-workflow-agent",
        "idempotencyKey": "idempotency-workflow-agent",
        "contextRefs": [{"id": "doc-1", "version": "v1"}],
        "toolAllowlist": ["swarm_git_status"],
        "sandbox": "read_only",
        "limits": {"maxSteps": 2, "maxWallTimeMs": 60_000, "maxModelTokens": 1_000, "maxEstimatedCost": 1},
    }
    routing.update(overrides)
    return routing


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


def test_executor_runs_explicit_bounded_agent_step_with_authoritative_route() -> None:
    async def scenario() -> None:
        runtime = FakeBoundedAgentRuntime({"status": "succeeded", "result": {"text": "read-only result"}})
        workflow = Workflow(
            name="bounded agent workflow",
            steps=[
                WorkflowStep(
                    name="inspect",
                    step_type=StepType.BOUNDED_AGENT,
                    config={
                        "routing": bounded_routing(),
                        "request": {
                            "operation": "tool_result",
                            "agentTaskId": "agent-task-1",
                            "prompt": "inspect state",
                            "toolName": "swarm_git_status",
                            "toolArguments": {"repoPath": "/tmp/read-only"},
                        },
                        "approvers": ["alice"],
                    },
                )
            ],
        )

        execution = await WorkflowExecutor(step_timeout=1, agent_runtime=runtime).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.COMPLETED
        assert runtime.calls[0]["decision"]["route"] == "bounded_agent"
        assert execution.steps[0].result["routeDecision"]["policyVersion"] == "task-execution-routing/v1"
        assert execution.routing_decisions[str(execution.steps[0].id)]["traceId"] == "trace-workflow-agent"
        assert any(event["eventType"] == "result" for event in execution.lifecycle_events)

    asyncio.run(scenario())


def test_bounded_agent_hard_command_signal_pauses_for_escalation_instead_of_running():
    async def scenario() -> None:
        runtime = FakeBoundedAgentRuntime({"status": "succeeded"})
        workflow = Workflow(
            name="blocked bounded agent workflow",
            steps=[
                WorkflowStep(
                    name="inspect",
                    step_type=StepType.BOUNDED_AGENT,
                    config={
                        "routing": bounded_routing(requestsCommand=True),
                        "request": {"operation": "tool_result", "toolName": "swarm_git_status"},
                        "approvers": ["alice"],
                    },
                )
            ],
        )

        execution = await WorkflowExecutor(step_timeout=1, agent_runtime=runtime).execute_workflow(workflow)

        assert execution.status == WorkflowStatus.WAITING_APPROVAL
        assert execution.pending_approval is not None
        assert execution.routing_decisions[str(execution.steps[0].id)]["reasonCode"] == "command_requested"
        assert runtime.calls == []

    asyncio.run(scenario())


def test_effect_proposal_requires_digest_bound_durable_approval_before_single_execution():
    async def scenario() -> None:
        action = {"kind": "document_write", "target": "docs/example.md", "parameters": {"content": "approved"}}
        proposal = {
            "schemaVersion": "task-execution-routing/v1",
            "proposalId": "proposal-workflow-agent",
            "traceId": "trace-workflow-agent",
            "idempotencyKey": "idempotency-workflow-agent",
            "summary": "Propose a document write.",
            "action": action,
            "actionDigest": action_digest(action),
        }
        runtime = FakeBoundedAgentRuntime({"status": "succeeded", "effectProposal": proposal})
        effects = FakeApprovedEffectExecutor()
        workflow = Workflow(
            name="approved effect workflow",
            steps=[
                WorkflowStep(
                    name="inspect",
                    step_type=StepType.BOUNDED_AGENT,
                    config={
                        "routing": bounded_routing(),
                        "request": {"operation": "tool_result", "toolName": "swarm_git_status"},
                        "approvers": ["alice"],
                    },
                ),
                WorkflowStep(
                    name="apply-approved-effect",
                    step_type=StepType.APPROVED_EFFECT,
                    config={
                        "proposalFrom": "inspect.agentResult.effectProposal",
                        "prompt": "Approve the exact document write",
                        "approvers": ["alice"],
                        "permissions": ["effect:document_write"],
                    },
                ),
            ],
        )
        executor = WorkflowExecutor(
            step_timeout=1,
            agent_runtime=runtime,
            approved_effect_executor=effects,
        )
        waiting = await executor.execute_workflow(workflow)

        assert waiting.status == WorkflowStatus.WAITING_APPROVAL
        assert waiting.pending_approval is not None
        assert waiting.pending_approval.action_digest == proposal["actionDigest"]
        assert effects.calls == []

        rejected = waiting.pending_approval.model_copy(
            update={
                "status": WorkflowApprovalStatus.REJECTED,
                "decided_by": "alice",
                "decision_comment": "not approved",
            }
        )
        rejected_execution = await executor.resume_workflow(workflow, waiting.model_copy(deep=True), rejected)
        assert rejected_execution.status == WorkflowStatus.FAILED
        assert effects.calls == []

        approval = waiting.pending_approval.model_copy(
            update={
                "status": WorkflowApprovalStatus.APPROVED,
                "decided_by": "alice",
                "decision_comment": "approved",
            }
        )
        resumed = await executor.resume_workflow(workflow, waiting, approval)

        assert resumed.status == WorkflowStatus.COMPLETED
        assert len(effects.calls) == 1
        assert effects.calls[0]["action"] == action
        assert resumed.steps[1].result["actionDigest"] == proposal["actionDigest"]
        assert effects.calls[0]["grant"]["usedAt"] is not None
        with pytest.raises(PermissionError, match="already been used"):
            await executor._execute_approved_effect(resumed.steps[1], resumed.result or {}, workflow.id)
        assert len(effects.calls) == 1

    asyncio.run(scenario())


def test_approved_effect_rejects_an_expired_one_time_grant():
    async def scenario() -> None:
        action = {"kind": "document_write", "target": "docs/example.md"}
        proposal = {
            "action": action,
            "actionDigest": action_digest(action),
        }
        effect_step = WorkflowStep(
            name="apply-approved-effect",
            step_type=StepType.APPROVED_EFFECT,
            config={
                "proposalFrom": "inspect.agentResult.effectProposal",
                "approvers": ["alice"],
                "permissions": ["effect:document_write"],
            },
        )
        workflow = Workflow(name="expired grant workflow", steps=[effect_step])
        context = {
            "inspect": {"agentResult": {"effectProposal": proposal}},
            "_approval_grants": {
                str(effect_step.id): {
                    "grantId": "grant-expired",
                    "actionDigest": proposal["actionDigest"],
                    "permissions": ["effect:document_write"],
                    "expiresAt": (datetime.now(UTC) - timedelta(seconds=1)).isoformat(),
                    "usedAt": None,
                }
            },
        }
        effects = FakeApprovedEffectExecutor()
        executor = WorkflowExecutor(approved_effect_executor=effects)

        with pytest.raises(PermissionError, match="expired"):
            await executor._execute_approved_effect(effect_step, context, workflow.id)
        assert effects.calls == []

    asyncio.run(scenario())
