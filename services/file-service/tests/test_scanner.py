import asyncio
import socket
import struct
import threading
from pathlib import Path

from scanner import ClamAVScanner, MalwareDetected, NoopScanner, ScannerUnavailable


def _run_fake_clamav(response: bytes):
    ready = threading.Event()
    received = bytearray()
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]

    def serve() -> None:
        ready.set()
        connection, _ = server.accept()
        with connection:
            assert connection.recv(len(b"zINSTREAM\0")) == b"zINSTREAM\0"
            while True:
                length = struct.unpack("!I", connection.recv(4))[0]
                if length == 0:
                    break
                remaining = length
                while remaining:
                    chunk = connection.recv(remaining)
                    received.extend(chunk)
                    remaining -= len(chunk)
            connection.sendall(response + b"\0")
        server.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    ready.wait(timeout=1)
    return port, received, thread


def test_noop_scanner_accepts_file(tmp_path: Path) -> None:
    path = tmp_path / "note.txt"
    path.write_bytes(b"hello")
    asyncio.run(NoopScanner().scan(path))


def test_clamav_scanner_streams_file_and_accepts_clean_result(tmp_path: Path) -> None:
    path = tmp_path / "note.txt"
    path.write_bytes(b"hello")
    port, received, thread = _run_fake_clamav(b"stream: OK")

    asyncio.run(ClamAVScanner("127.0.0.1", port, timeout_seconds=1).scan(path))
    thread.join(timeout=1)
    assert bytes(received) == b"hello"


def test_clamav_scanner_rejects_signature(tmp_path: Path) -> None:
    path = tmp_path / "eicar.txt"
    path.write_bytes(b"test")
    port, _, thread = _run_fake_clamav(b"stream: Eicar-Test-Signature FOUND")

    try:
        asyncio.run(ClamAVScanner("127.0.0.1", port, timeout_seconds=1).scan(path))
    except MalwareDetected:
        pass
    else:
        raise AssertionError("infected file was accepted")
    thread.join(timeout=1)


def test_clamav_scanner_reports_unavailable() -> None:
    try:
        asyncio.run(ClamAVScanner("127.0.0.1", 1, timeout_seconds=0.1).scan(Path("/does/not/matter")))
    except ScannerUnavailable:
        pass
    else:
        raise AssertionError("unavailable scanner was not reported")
