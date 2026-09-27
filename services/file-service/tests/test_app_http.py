"""App-level HTTP tests for the file service.

These tests exercise the FastAPI ASGI application directly through
httpx.ASGITransport, NOT through a live uvicorn server. This means we
cover the full router + dependency-injection + middleware chain without
the flakiness of port allocation, process startup, and shutdown.

Why ASGITransport rather than TestClient:
  - ASGITransport speaks ASGI natively through httpx.AsyncClient, which
    keeps the entire test async and avoids spawning a Starlette
    TestClient thread per call.
  - This matches how the production API Gateway invokes the service via
    httpx ASGI in unit tests for other apps in the workspace.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

pytest_plugins = ["pytest_asyncio"]


@pytest.fixture
def storage_dir() -> Path:
    with tempfile.TemporaryDirectory(prefix="axi-file-app-test-") as tmp:
        yield Path(tmp)


@pytest.fixture
def app_with_state(storage_dir: Path):
    """Build a fresh File Service FastAPI app wired to in-memory storage.

    The fixture monkey-patches config.settings + the routers.set_file_service
    global so the app can run without Postgres or S3. We rebuild the app
    module's singleton for the duration of the test.
    """
    # All Settings reads happen at import time on the singleton `settings`,
    # so set the env vars BEFORE importing main / routers.
    os.environ["FILE_STORAGE_PATH"] = str(storage_dir)
    os.environ["FILE_STORAGE_BACKEND"] = "local"
    os.environ["FILE_INTERNAL_SERVICE_TOKEN"] = "axi-development-internal-token"
    os.environ["FILE_MAX_FILE_SIZE"] = str(1024 * 1024)  # 1 MiB cap
    os.environ["FILE_VIRUS_SCAN_BACKEND"] = "disabled"
    os.environ["FILE_THUMBNAIL_ENABLED"] = "false"
    os.environ["FILE_DATABASE_URL"] = ""  # force MemoryFileRepository
    os.environ["FILE_S3_ENDPOINT_URL"] = ""
    os.environ["FILE_S3_BUCKET"] = ""

    # Import fresh — the module-level Settings() reads env at import time.
    import importlib

    import config as config_module
    import routers.files as routers_files
    import main as main_module
    import repository as repository_module
    import service as service_module

    importlib.reload(config_module)
    importlib.reload(repository_module)
    importlib.reload(service_module)
    importlib.reload(routers_files)
    importlib.reload(main_module)

    app = main_module.app

    # ASGI TestClient does NOT run lifespan automatically; we drive the
    # lifespan manually so the file_service global is populated for the
    # routes that depend on it. Without this, every dependency-injected
    # call returns 503 ("file service is starting").
    import asyncio
    from contextlib import asynccontextmanager

    lifespan_cm = main_module.lifespan(app)

    @asynccontextmanager
    async def _active_lifespan(_request):
        async with lifespan_cm:
            yield

    # httpx.ASGITransport accepts a `lifespan` callable in newer versions
    # but the simpler path is to drive it from inside each test. We expose
    # the context manager for tests that need it and prime file_service
    # synchronously via a quick event loop so single-test invocation works.
    try:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_prime_file_service(lifespan_cm))
    finally:
        loop.close()

    return app


async def _prime_file_service(lifespan_cm):
    # Enter the lifespan context, run the startup work, then leave it open
    # for the duration of the test (we exit on app shutdown via the test
    # session's atexit-style cleanup below).
    await lifespan_cm.__aenter__()
    # Register an exit hook so the lifespan is properly closed.
    import atexit
    atexit.register(lambda: lifespan_cm.__aexit__(None, None, None))


@pytest.fixture
def gateway_headers() -> dict[str, str]:
    """Standard headers that satisfy require_gateway_identity()."""
    return {
        "X-Axi-Internal-Token": "axi-development-internal-token",
        "X-Axi-Subject": "user:test-subject",
    }


@pytest.mark.asyncio
async def test_health_endpoint_is_unauthenticated(app_with_state) -> None:
    """GET /files/health must not require a gateway credential."""
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/files/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"


@pytest.mark.asyncio
async def test_upload_requires_gateway_identity(app_with_state) -> None:
    """POST /files/upload without internal token must be 401."""
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        files = {"file": ("hello.txt", b"hello world", "text/plain")}
        response = await client.post("/files/upload", files=files)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_then_download_roundtrip(app_with_state, gateway_headers) -> None:
    """Upload a file, list it, then download it back through the app."""
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        files = {"file": ("hello.txt", b"hello app", "text/plain")}
        upload_resp = await client.post(
            "/files/upload",
            files=files,
            headers=gateway_headers,
        )
        assert upload_resp.status_code == 201, upload_resp.text
        upload_body = upload_resp.json()
        assert upload_body["name"] == "hello.txt"
        assert upload_body["size"] == len(b"hello app")

        # List the files owned by the verified subject.
        list_resp = await client.get("/files/", headers=gateway_headers)
        assert list_resp.status_code == 200
        listing = list_resp.json()
        names = [item["name"] for item in listing["files"]]
        assert "hello.txt" in names

        # Download back. The app returns a FileResponse (streaming); we
        # consume the body to verify the bytes survive the round-trip.
        download_resp = await client.get("/files/download/hello.txt", headers=gateway_headers)
        assert download_resp.status_code == 200
        assert download_resp.content == b"hello app"
        assert download_resp.headers["content-type"].startswith("text/plain")


@pytest.mark.asyncio
async def test_upload_rejects_path_traversal(app_with_state, gateway_headers) -> None:
    """A filename containing a slash must be rejected as 400."""
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        files = {"file": ("../escape.txt", b"x", "text/plain")}
        response = await client.post(
            "/files/upload",
            files=files,
            headers=gateway_headers,
        )
    assert response.status_code == 400, response.text


@pytest.mark.asyncio
async def test_upload_accepts_default_extensions(app_with_state, gateway_headers) -> None:
    """Default allowed_extensions is ['*'], so binary files are accepted.

    This is the inverse of the rejection test below: it asserts the default
    behavior (any extension) is wired through the validator and does NOT
    block legitimate uploads when the operator has not tightened the list.
    """
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        files = {"file": ("payload.bin", b"\x4d\x5a", "application/octet-stream")}
        response = await client.post(
            "/files/upload",
            files=files,
            headers=gateway_headers,
        )
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_upload_rejects_path_components(app_with_state, gateway_headers) -> None:
    """A filename containing a path separator must be rejected as 400.

    This exercises the same code path as the ../escape test above but
    verifies the Windows-style backslash separator is also rejected.
    """
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        files = {"file": ("subdir\\file.txt", b"hello", "text/plain")}
        response = await client.post(
            "/files/upload",
            files=files,
            headers=gateway_headers,
        )
    assert response.status_code == 400, response.text


@pytest.mark.asyncio
async def test_download_missing_file_returns_404(app_with_state, gateway_headers) -> None:
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(f"/files/download/{uuid4().hex}.txt", headers=gateway_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_then_list_omits_file(app_with_state, gateway_headers) -> None:
    """Delete an uploaded file, then list and confirm it is gone."""
    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        files = {"file": ("temporary.txt", b"byebye", "text/plain")}
        upload_resp = await client.post(
            "/files/upload",
            files=files,
            headers=gateway_headers,
        )
        assert upload_resp.status_code == 201

        delete_resp = await client.delete("/files/temporary.txt", headers=gateway_headers)
        assert delete_resp.status_code == 200
        assert delete_resp.json()["message"] == "File deleted successfully"

        list_resp = await client.get("/files/", headers=gateway_headers)
        names = [item["name"] for item in list_resp.json()["files"]]
        assert "temporary.txt" not in names


@pytest.mark.asyncio
async def test_readyz_returns_service_unavailable_when_storage_unreachable(
    app_with_state,
) -> None:
    """When the configured storage path becomes unreadable, /files/ready must flip to 503.

    The app's lifespan handler eagerly validates the storage directory, so we
    instead simulate a mid-test regression by closing the underlying file
    service. This exercises the same dependency that /files/ready pings.
    """
    from routers import files as routers_files

    transport = httpx.ASGITransport(app=app_with_state)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # baseline: ready when the service is healthy
        ok_resp = await client.get("/files/ready")
        assert ok_resp.status_code == 200
        assert ok_resp.json()["status"] == "ready"

        # Force the file service into a state where ping() raises; /files/ready
        # must report 503 so the platform knows to remove the pod.
        original_service = routers_files.file_service
        routers_files.file_service = None
        try:
            down_resp = await client.get("/files/ready")
            assert down_resp.status_code == 503
        finally:
            routers_files.file_service = original_service