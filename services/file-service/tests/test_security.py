from fastapi.testclient import TestClient

from config import settings
from main import app


def test_health_is_available_without_gateway_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/files/health")
    assert response.status_code == 200


def test_file_routes_require_gateway_credential_and_subject() -> None:
    original_token = settings.internal_service_token
    settings.internal_service_token = "file-test-token"
    try:
        with TestClient(app) as client:
            missing = client.get("/files/")
            wrong = client.get(
                "/files/",
                headers={"X-Axi-Internal-Token": "wrong", "X-Axi-Subject": "alice"},
            )
            valid_without_subject = client.get(
                "/files/", headers={"X-Axi-Internal-Token": "file-test-token"}
            )
        assert missing.status_code == 401
        assert wrong.status_code == 401
        assert valid_without_subject.status_code == 401
    finally:
        settings.internal_service_token = original_token


def test_files_are_isolated_by_verified_subject(tmp_path) -> None:
    original_token = settings.internal_service_token
    original_storage = settings.storage_path
    settings.internal_service_token = "file-test-token"
    settings.storage_path = tmp_path
    try:
        headers = {
            "X-Axi-Internal-Token": "file-test-token",
            "X-Axi-Subject": "alice",
        }
        with TestClient(app) as client:
            uploaded = client.post(
                "/files/upload", headers=headers, files={"file": ("note.txt", b"hello", "text/plain")}
            )
            alice = client.get("/files/", headers=headers)
            bob = client.get(
                "/files/",
                headers={
                    "X-Axi-Internal-Token": "file-test-token",
                    "X-Axi-Subject": "bob",
                },
            )
        assert uploaded.status_code == 201
        assert uploaded.json()["checksum_sha256"] == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        assert alice.json()["total"] == 1
        assert alice.json()["files"][0]["checksum_sha256"] == uploaded.json()["checksum_sha256"]
        assert bob.json()["total"] == 0
    finally:
        settings.internal_service_token = original_token
        settings.storage_path = original_storage


def test_file_name_cannot_escape_subject_storage(tmp_path) -> None:
    original_token = settings.internal_service_token
    original_storage = settings.storage_path
    settings.internal_service_token = "file-test-token"
    settings.storage_path = tmp_path
    try:
        with TestClient(app) as client:
            response = client.post(
                "/files/upload",
                headers={
                    "X-Axi-Internal-Token": "file-test-token",
                    "X-Axi-Subject": "alice",
                },
                files={"file": ("../escape.txt", b"nope", "text/plain")},
            )
        assert response.status_code == 400
    finally:
        settings.internal_service_token = original_token
        settings.storage_path = original_storage


def test_file_objects_cannot_be_downloaded_or_deleted_by_another_subject(tmp_path) -> None:
    original_token = settings.internal_service_token
    original_storage = settings.storage_path
    settings.internal_service_token = "file-test-token"
    settings.storage_path = tmp_path
    try:
        alice_headers = {
            "X-Axi-Internal-Token": "file-test-token",
            "X-Axi-Subject": "alice",
        }
        bob_headers = {
            "X-Axi-Internal-Token": "file-test-token",
            "X-Axi-Subject": "bob",
        }
        with TestClient(app) as client:
            assert client.post(
                "/files/upload", headers=alice_headers, files={"file": ("private.txt", b"secret", "text/plain")}
            ).status_code == 201
            assert client.get("/files/download/private.txt", headers=bob_headers).status_code == 404
            assert client.delete("/files/private.txt", headers=bob_headers).status_code == 404
            assert client.get("/files/download/private.txt", headers=alice_headers).content == b"secret"
    finally:
        settings.internal_service_token = original_token
        settings.storage_path = original_storage
