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
