from uuid import UUID

from fastapi.testclient import TestClient

from config import get_settings
from main import app


def test_workflow_routes_require_gateway_credential_and_subject() -> None:
    settings = get_settings()
    original_token = settings.internal_service_token
    settings.internal_service_token = "workflow-test-token"
    try:
        with TestClient(app) as client:
            missing = client.get("/workflows")
            wrong = client.get(
                "/workflows",
                headers={"X-Axi-Internal-Token": "wrong", "X-Axi-Subject": "alice"},
            )
            no_subject = client.get(
                "/workflows", headers={"X-Axi-Internal-Token": "workflow-test-token"}
            )
        assert missing.status_code == 401
        assert wrong.status_code == 401
        assert no_subject.status_code == 401
    finally:
        settings.internal_service_token = original_token


def test_workflows_are_scoped_to_verified_subject() -> None:
    settings = get_settings()
    original_token = settings.internal_service_token
    settings.internal_service_token = "workflow-test-token"
    headers = {
        "X-Axi-Internal-Token": "workflow-test-token",
        "X-Axi-Subject": "alice",
    }
    try:
        with TestClient(app) as client:
            created = client.post(
                "/workflows",
                headers=headers,
                json={"name": "Alice workflow", "triggerTopic": "task.created", "steps": []},
            )
            workflow_id = created.json()["id"]
            alice = client.get(f"/workflows/{workflow_id}", headers=headers)
            bob = client.get(
                f"/workflows/{workflow_id}",
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Subject": "bob",
                },
            )
        assert created.status_code == 201
        assert alice.status_code == 200
        assert bob.status_code == 404
    finally:
        # Keep the module-level demo store deterministic for the next test.
        from routers.workflows import workflows_db, executing_workflows

        workflows_db.clear()
        executing_workflows.clear()
        settings.internal_service_token = original_token


def test_workflow_approval_is_durable_and_resumes_only_for_allowed_approver() -> None:
    settings = get_settings()
    original_token = settings.internal_service_token
    settings.internal_service_token = "workflow-test-token"
    headers = {
        "X-Axi-Internal-Token": "workflow-test-token",
        "X-Axi-Subject": "alice",
    }
    try:
        with TestClient(app) as client:
            created = client.post(
                "/workflows",
                headers=headers,
                json={
                    "name": "Approval workflow",
                    "steps": [
                        {
                            "name": "release-approval",
                            "step_type": "approval",
                            "config": {"prompt": "Approve release", "approvers": ["alice", "bob"]},
                        },
                        {"name": "release", "step_type": "task", "config": {"action": "release"}},
                    ],
                },
            )
            workflow_id = created.json()["id"]
            waiting = client.post(f"/workflows/{workflow_id}/execute", headers=headers)
            approval_id = waiting.json()["pendingApproval"]["id"]
            rejected_by_carol = client.post(
                f"/workflows/{workflow_id}/approvals/{approval_id}",
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Subject": "carol",
                },
                json={"decision": "approved"},
            )
            resumed_by_bob = client.post(
                f"/workflows/{workflow_id}/approvals/{approval_id}",
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Subject": "bob",
                },
                json={"decision": "approved", "comment": "approved"},
            )
            duplicate = client.post(
                f"/workflows/{workflow_id}/approvals/{approval_id}",
                headers=headers,
                json={"decision": "approved"},
            )
        assert created.status_code == 201
        assert waiting.status_code == 200
        assert waiting.json()["status"] == "waiting_approval"
        assert rejected_by_carol.status_code == 403
        assert resumed_by_bob.status_code == 200
        assert resumed_by_bob.json()["status"] == "completed"
        assert duplicate.status_code == 409
    finally:
        from routers.workflows import executing_workflows, get_repository, workflows_db

        workflows_db.clear()
        executing_workflows.clear()
        repository = get_repository()
        if hasattr(repository, "approvals"):
            repository.approvals.clear()
        settings.internal_service_token = original_token


def test_platform_event_route_requires_token_and_event_headers() -> None:
    settings = get_settings()
    original_token = settings.internal_service_token
    settings.internal_service_token = "workflow-test-token"
    try:
        with TestClient(app) as client:
            created = client.post(
                "/workflows",
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Subject": "alice",
                },
                json={"name": "Event workflow", "triggerTopic": "task.created", "steps": []},
            )
            missing = client.post(
                "/internal/events",
                json={"id": "event-1", "tenantId": "tenant-1", "topic": "task.created", "payload": {}},
                headers={"X-Axi-Event-ID": "event-1", "X-Axi-Event-Topic": "task.created"},
            )
            accepted = client.post(
                "/internal/events",
                json={"id": "event-1", "tenantId": "tenant-1", "topic": "task.created", "payload": {"createdBy": "alice"}},
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Event-ID": "event-1",
                    "X-Axi-Event-Topic": "task.created",
                },
            )
            duplicate = client.post(
                "/internal/events",
                json={"id": "event-1", "tenantId": "tenant-1", "topic": "task.created", "payload": {"createdBy": "alice"}},
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Event-ID": "event-1",
                    "X-Axi-Event-Topic": "task.created",
                },
            )
            event_workflow = client.get(
                f"/workflows/{created.json()['id']}",
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Subject": "alice",
                },
            )
            from routers.workflows import get_repository

            repository = get_repository()
            dispatch_created = ("event-1", UUID(created.json()["id"])) in repository.event_dispatches
        assert missing.status_code == 401
        assert accepted.status_code == 204
        assert duplicate.status_code == 204
        assert created.status_code == 201
        assert event_workflow.json()["triggerTopic"] == "task.created"
        assert dispatch_created
    finally:
        from routers.workflows import get_repository

        repository = get_repository()
        if hasattr(repository, "event_inbox"):
            repository.event_inbox.clear()
        if hasattr(repository, "event_dispatches"):
            repository.event_dispatches.clear()
        if hasattr(repository, "workflows"):
            repository.workflows.clear()
        settings.internal_service_token = original_token


def test_agent_lifecycle_events_require_trusted_producer_and_traceability() -> None:
    settings = get_settings()
    original_token = settings.internal_service_token
    settings.internal_service_token = "workflow-test-token"
    event = {
        "id": "agent-event-telemetry-1",
        "tenantId": "workspace",
        "topic": "agent.result",
        "payload": {"agentTaskId": "agent-task-1", "eventType": "completed"},
        "producer": "agent-platform",
        "traceId": "trace-agent-lifecycle-test",
        "idempotencyKey": "idempotency-agent-lifecycle-test",
    }
    try:
        with TestClient(app) as client:
            untrusted = client.post(
                "/internal/events",
                json=event,
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Event-ID": event["id"],
                    "X-Axi-Event-Topic": event["topic"],
                    "X-Axi-Event-Producer": "other-service",
                },
            )
            missing_trace = client.post(
                "/internal/events",
                json={key: value for key, value in event.items() if key != "traceId"},
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Event-ID": event["id"],
                    "X-Axi-Event-Topic": event["topic"],
                    "X-Axi-Event-Producer": "agent-platform",
                },
            )
            accepted = client.post(
                "/internal/events",
                json=event,
                headers={
                    "X-Axi-Internal-Token": "workflow-test-token",
                    "X-Axi-Event-ID": event["id"],
                    "X-Axi-Event-Topic": event["topic"],
                    "X-Axi-Event-Producer": "agent-platform",
                },
            )
        assert untrusted.status_code == 401
        assert missing_trace.status_code == 400
        assert accepted.status_code == 204
    finally:
        from routers.workflows import get_repository

        repository = get_repository()
        if hasattr(repository, "event_inbox"):
            repository.event_inbox.pop(event["id"], None)
        settings.internal_service_token = original_token


def test_waiting_bounded_agent_workflow_can_be_cancelled_without_resuming_effects() -> None:
    settings = get_settings()
    original_token = settings.internal_service_token
    settings.internal_service_token = "workflow-test-token"
    headers = {
        "X-Axi-Internal-Token": "workflow-test-token",
        "X-Axi-Subject": "alice",
    }
    try:
        with TestClient(app) as client:
            created = client.post(
                "/workflows",
                headers=headers,
                json={
                    "name": "Cancellable bounded Agent workflow",
                    "steps": [
                        {
                            "name": "blocked-agent",
                            "step_type": "bounded_agent",
                            "config": {
                                "routing": {
                                    "requestsCommand": True,
                                    "traceId": "trace-cancel-bounded-agent",
                                    "idempotencyKey": "idempotency-cancel-bounded-agent",
                                },
                                "request": {"operation": "tool_result", "toolName": "swarm_git_status"},
                                "approvers": ["alice"],
                            },
                        }
                    ],
                },
            )
            workflow_id = created.json()["id"]
            waiting = client.post(f"/workflows/{workflow_id}/execute", headers=headers)
            approval_id = waiting.json()["pendingApproval"]["id"]
            cancelled = client.post(f"/workflows/{workflow_id}/cancel", headers=headers)
            decision_after_cancel = client.post(
                f"/workflows/{workflow_id}/approvals/{approval_id}",
                headers=headers,
                json={"decision": "approved"},
            )
        assert waiting.status_code == 200
        assert waiting.json()["status"] == "waiting_approval"
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"
        assert cancelled.json()["pendingApproval"] is None
        assert any(event["eventType"] == "cancelled" for event in cancelled.json()["lifecycleEvents"])
        assert decision_after_cancel.status_code == 409
    finally:
        from routers.workflows import get_repository, workflows_db, executing_workflows

        workflows_db.clear()
        executing_workflows.clear()
        repository = get_repository()
        if hasattr(repository, "approvals"):
            repository.approvals.clear()
        settings.internal_service_token = original_token
