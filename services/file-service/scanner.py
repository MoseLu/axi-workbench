"""Virus-scanning adapters for uploaded files.

The file service keeps scanning behind a small async contract so local
development can use a no-op adapter while production fails closed when the
configured ClamAV service is unavailable.
"""

from __future__ import annotations

import asyncio
import socket
import struct
from pathlib import Path
from typing import Protocol


class ScanError(RuntimeError):
    """Base error for scanner failures."""


class ScannerUnavailable(ScanError):
    """The configured scanner could not complete the scan."""


class MalwareDetected(ScanError):
    """The scanner found a malware signature."""

    def __init__(self, signature: str) -> None:
        self.signature = signature
        super().__init__("malware detected")


class FileScanner(Protocol):
    async def scan(self, path: Path) -> None:
        """Raise when the file cannot be accepted."""


class NoopScanner:
    """Development adapter; production configuration must not use it."""

    async def scan(self, _path: Path) -> None:
        return None


class ClamAVScanner:
    """ClamAV daemon adapter using the documented INSTREAM protocol."""

    def __init__(self, host: str, port: int, timeout_seconds: float = 30.0) -> None:
        self.host = host
        self.port = port
        self.timeout_seconds = max(0.1, timeout_seconds)

    async def scan(self, path: Path) -> None:
        await asyncio.to_thread(self._scan_sync, path)

    def _scan_sync(self, path: Path) -> None:
        try:
            with socket.create_connection((self.host, self.port), timeout=self.timeout_seconds) as connection:
                connection.settimeout(self.timeout_seconds)
                connection.sendall(b"zINSTREAM\0")
                with path.open("rb") as source:
                    while chunk := source.read(1024 * 1024):
                        connection.sendall(struct.pack("!I", len(chunk)))
                        connection.sendall(chunk)
                connection.sendall(b"\0\0\0\0")
                response = _read_response(connection)
        except (OSError, ValueError) as exc:
            raise ScannerUnavailable("virus scanner unavailable") from exc

        if response.endswith("FOUND"):
            signature = response.removesuffix(" FOUND").removeprefix("stream: ").strip()
            raise MalwareDetected(signature or "unknown signature")
        if response.endswith("OK"):
            return
        raise ScannerUnavailable("virus scanner returned an invalid result")


def _read_response(connection: socket.socket) -> str:
    response = bytearray()
    while len(response) < 4096:
        chunk = connection.recv(512)
        if not chunk:
            break
        response.extend(chunk)
        if b"\0" in response:
            break
    if b"\0" in response:
        response = response.split(b"\0", 1)[0]
    return response.decode("utf-8", errors="replace").strip()
