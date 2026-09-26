"""Typed, single-use execution boundary for already-approved side effects."""
from __future__ import annotations

from typing import Any, Protocol


class ApprovedEffectExecutor(Protocol):
    async def execute(self, *, action: dict[str, Any], grant: dict[str, Any]) -> dict[str, Any]:
        """Execute exactly the digest-bound effect with the supplied one-time grant."""


class DenyApprovedEffectExecutor:
    """Default is intentionally fail-closed until a concrete effect owner is wired."""

    async def execute(self, *, action: dict[str, Any], grant: dict[str, Any]) -> dict[str, Any]:
        raise PermissionError("approved effect executor is not configured")
