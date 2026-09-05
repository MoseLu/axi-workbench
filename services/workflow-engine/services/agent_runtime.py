"""Typed bounded-Agent boundary; it never reuses the generic HTTP workflow step."""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol
from uuid import uuid4

import httpx


POLICY_VERSION = "task-execution-routing/v1"


class BoundedAgentRuntimeError(RuntimeError):
    """The bounded Agent runtime rejected or could not process a route."""


class BoundedAgentRuntime(Protocol):
    async def run(self, *, decision: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
        """Run exactly one workflow-authorized, read-only Agent operation."""


class UnavailableBoundedAgentRuntime:
    """Fail closed until a typed internal Agent runtime endpoint is configured."""

    async def run(self, *, decision: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
        raise BoundedAgentRuntimeError("bounded Agent runtime is not configured")


class HttpBoundedAgentRuntime:
    """Internal client for the Agent Platform's guarded workstation endpoints."""

    _operation_paths = {
        "tool_result": "/api/v1/workstation/agent-tasks/tool-result",
        "quality_gate": "/api/v1/workstation/agent-tasks/quality-gate",
        "effect_proposal": "/api/v1/workstation/agent-tasks/effect-proposal",
    }

    def __init__(
        self,
        *,
        base_url: str,
        route_credential_secret: str,
        internal_event_token: str,
        timeout_seconds: float = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.route_credential_secret = route_credential_secret
        self.internal_event_token = internal_event_token
        self.timeout_seconds = max(0.1, float(timeout_seconds))

    async def run(self, *, decision: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
        if not self.base_url or not self.route_credential_secret or not self.internal_event_token:
            raise BoundedAgentRuntimeError("bounded Agent runtime credentials are not configured")
        operation = str(request.get("operation", "tool_result"))
        path = self._operation_paths.get(operation)
        if path is None:
            raise BoundedAgentRuntimeError(f"unsupported bounded Agent operation: {operation}")
        credential = issue_route_credential(decision, self.route_credential_secret)
        body = _request_body(operation, request)
        body.update(
            {
                "source": "axi-workbench-workflow-engine",
                "routeDecision": decision,
                "routeCredential": credential,
            }
        )
        headers = {"X-Axi-Workflow-Token": self.internal_event_token}
        async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=False) as client:
            response = await client.post(f"{self.base_url}{path}", json=body, headers=headers)
        if response.status_code < 200 or response.status_code >= 300:
            try:
                detail = response.json()
            except ValueError:
                detail = {"status": response.status_code}
            raise BoundedAgentRuntimeError(f"bounded Agent runtime rejected request: {detail}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise BoundedAgentRuntimeError("bounded Agent runtime returned non-JSON output") from exc
        return {"status": payload.get("status", "succeeded"), "result": payload}


def decide_route(routing: Any, *, workflow_id: str, step_id: str) -> dict[str, Any]:
    """Create the authoritative decision from bounded signals, not model output."""
    if not isinstance(routing, dict):
        routing = {}
    hard_signals = {
        "requestsCommand": "command_requested",
        "requestsWrite": "write_requested",
        "requestsExternalSideEffect": "external_side_effect_requested",
        "requestsPrivilegeEscalation": "privilege_escalation_requested",
    }
    route = "escalate"
    reason_code = "unknown_request"
    for signal, reason in hard_signals.items():
        if routing.get(signal) is True:
            reason_code = reason
            break
    else:
        if routing.get("pathEnumerable") is True:
            route, reason_code = "workflow", "enumerable_path"
        elif routing.get("localPathUnenumerable") is True and routing.get("readOnly") is True:
            route, reason_code = "bounded_agent", "read_only_open_exploration"

    trace_id = _nonempty_string(routing.get("traceId"), f"wf-{workflow_id}-{step_id}")
    idempotency_key = _nonempty_string(routing.get("idempotencyKey"), f"wf-{workflow_id}-{step_id}")
    context_refs = routing.get("contextRefs", [])
    tool_allowlist = routing.get("toolAllowlist", [])
    limits = routing.get("limits", {})
    decision = {
        "schemaVersion": POLICY_VERSION,
        "route": route,
        "reasonCode": reason_code,
        "policyVersion": POLICY_VERSION,
        "traceId": trace_id,
        "idempotencyKey": idempotency_key,
        "contextRefs": context_refs if isinstance(context_refs, list) else [],
        "toolAllowlist": tool_allowlist if isinstance(tool_allowlist, list) else [],
        "sandbox": routing.get("sandbox", "none"),
        "limits": {
            "maxSteps": limits.get("maxSteps", 0) if isinstance(limits, dict) else 0,
            "maxWallTimeMs": limits.get("maxWallTimeMs", 0) if isinstance(limits, dict) else 0,
            "maxModelTokens": limits.get("maxModelTokens", 0) if isinstance(limits, dict) else 0,
            "maxEstimatedCost": limits.get("maxEstimatedCost", 0) if isinstance(limits, dict) else 0,
        },
    }
    return decision


def validate_bounded_decision(decision: dict[str, Any], *, allowed_tools: set[str]) -> None:
    if decision.get("schemaVersion") != POLICY_VERSION or decision.get("policyVersion") != POLICY_VERSION:
        raise BoundedAgentRuntimeError("bounded Agent route has an unsupported policy version")
    if decision.get("route") != "bounded_agent":
        raise BoundedAgentRuntimeError(f"bounded Agent step requires bounded_agent route, got {decision.get('route')}")
    if decision.get("sandbox") != "read_only":
        raise BoundedAgentRuntimeError("bounded Agent requires the read_only sandbox")
    tools = decision.get("toolAllowlist")
    if not isinstance(tools, list) or not tools or any(not isinstance(tool, str) for tool in tools):
        raise BoundedAgentRuntimeError("bounded Agent requires an explicit read-only tool allowlist")
    if not set(tools).issubset(allowed_tools):
        raise BoundedAgentRuntimeError("bounded Agent allowlist contains an unapproved tool")
    limits = decision.get("limits")
    if not isinstance(limits, dict):
        raise BoundedAgentRuntimeError("bounded Agent limits are required")
    for field in ("maxSteps", "maxWallTimeMs", "maxModelTokens", "maxEstimatedCost"):
        value = limits.get(field)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
            raise BoundedAgentRuntimeError(f"bounded Agent limit is invalid: {field}")
    if limits["maxSteps"] < 1 or limits["maxWallTimeMs"] < 1:
        raise BoundedAgentRuntimeError("bounded Agent requires positive step and time limits")


def issue_route_credential(decision: dict[str, Any], secret: str, *, now: datetime | None = None) -> dict[str, str]:
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + timedelta(minutes=5)
    credential = {
        "credentialId": str(uuid4()),
        "subject": "axi-workbench-workflow-engine",
        "decisionDigest": decision_digest(decision),
        "issuedAt": issued_at.isoformat(),
        "expiresAt": expires_at.isoformat(),
    }
    credential["signature"] = hmac.new(
        secret.encode(), _canonical_json(credential).encode(), hashlib.sha256
    ).hexdigest()
    return credential


def decision_digest(decision: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_json(decision).encode()).hexdigest()


def action_digest(action: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_json(action).encode()).hexdigest()


def _request_body(operation: str, request: dict[str, Any]) -> dict[str, Any]:
    task_id = _nonempty_string(request.get("agentTaskId"), f"agent-{uuid4()}")
    prompt = _nonempty_string(request.get("prompt"), "bounded workflow exploration")
    if operation == "tool_result":
        tool_name = request.get("toolName")
        if not isinstance(tool_name, str) or not tool_name:
            raise BoundedAgentRuntimeError("tool_result bounded Agent request requires toolName")
        arguments = request.get("toolArguments", {})
        if not isinstance(arguments, dict):
            raise BoundedAgentRuntimeError("toolArguments must be an object")
        return {"agentTaskId": task_id, "prompt": prompt, "toolName": tool_name, "toolArguments": arguments}
    if operation == "quality_gate":
        gate_ids = request.get("gateIds", ["code_quality"])
        if not isinstance(gate_ids, list) or any(not isinstance(item, str) for item in gate_ids):
            raise BoundedAgentRuntimeError("gateIds must be a string list")
        return {"agentTaskId": task_id, "prompt": prompt, "gateIds": gate_ids}
    proposal = request.get("proposal")
    if not isinstance(proposal, dict):
        raise BoundedAgentRuntimeError("effect_proposal requires a proposal object")
    return {"agentTaskId": task_id, "proposal": proposal}


def _nonempty_string(value: Any, fallback: str) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else fallback


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
