"""Restricted outbound HTTP client for workflow task steps."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import socket
from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx


class OutboundHTTPError(ValueError):
    """The workflow HTTP request violates the egress policy."""


class HttpStepClient(Protocol):
    async def request(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        body: Any,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        """Perform a policy-checked request and return a bounded response."""


class HttpxStepClient:
    """HTTPX adapter with explicit egress and response-size controls."""

    _allowed_methods = frozenset({"DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"})

    def __init__(
        self,
        *,
        allowed_hosts: set[str] | frozenset[str] = frozenset(),
        allow_insecure_http: bool = False,
        max_response_bytes: int = 1024 * 1024,
    ) -> None:
        self.allowed_hosts = frozenset(host.lower().strip() for host in allowed_hosts if host.strip())
        self.allow_insecure_http = allow_insecure_http
        self.max_response_bytes = max(1, max_response_bytes)

    async def request(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        body: Any,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        normalized_method = method.upper().strip()
        parsed = self._validate_url(normalized_method, url)
        await self._reject_private_resolution(parsed.hostname or "", parsed.port)
        timeout = max(0.1, float(timeout_seconds))
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
            request_kwargs: dict[str, Any] = {"headers": headers}
            if body is not None and normalized_method not in {"GET", "HEAD"}:
                request_kwargs["json"] = body
            async with client.stream(normalized_method, url, **request_kwargs) as response:
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > self.max_response_bytes:
                        raise OutboundHTTPError("workflow HTTP response exceeds configured size limit")
                return {
                    "statusCode": response.status_code,
                    "headers": {
                        key: value
                        for key, value in response.headers.items()
                        if key.lower() in {"content-type", "location"}
                    },
                    "body": _decode_response(bytes(content), response.headers.get("content-type", "")),
                }

    def _validate_url(self, method: str, url: str):
        if method not in self._allowed_methods:
            raise OutboundHTTPError(f"workflow HTTP method is not allowed: {method}")
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise OutboundHTTPError("workflow HTTP URL must be an absolute HTTP(S) URL without credentials")
        if parsed.scheme != "https" and not self.allow_insecure_http:
            raise OutboundHTTPError("workflow HTTP requests must use HTTPS")
        hostname = parsed.hostname.lower().rstrip(".")
        if not _host_matches_allowlist(hostname, self.allowed_hosts):
            raise OutboundHTTPError(f"workflow HTTP host is not allowlisted: {hostname}")
        return parsed

    async def _reject_private_resolution(self, hostname: str, port: int | None) -> None:
        try:
            literal = ipaddress.ip_address(hostname)
        except ValueError:
            literal = None
        if literal is not None:
            if _is_private_address(literal):
                raise OutboundHTTPError("workflow HTTP cannot target a private or local address")
            return

        try:
            addresses = await asyncio.to_thread(
                socket.getaddrinfo,
                hostname,
                port or 443,
                type=socket.SOCK_STREAM,
            )
        except OSError as exc:
            raise OutboundHTTPError("workflow HTTP host could not be resolved") from exc
        resolved = {info[4][0] for info in addresses}
        if not resolved or any(_is_private_address(ipaddress.ip_address(address)) for address in resolved):
            raise OutboundHTTPError("workflow HTTP host resolves to a private or local address")


def _host_matches_allowlist(hostname: str, allowed_hosts: frozenset[str]) -> bool:
    if hostname in allowed_hosts:
        return True
    return any(entry.startswith("*.") and hostname.endswith(entry[1:]) for entry in allowed_hosts)


def _is_private_address(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return any(
        (
            address.is_private,
            address.is_loopback,
            address.is_link_local,
            address.is_reserved,
            address.is_multicast,
            address.is_unspecified,
        )
    )


def _decode_response(content: bytes, content_type: str) -> Any:
    if "json" in content_type.lower():
        try:
            return json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            pass
    return content.decode("utf-8", errors="replace")
