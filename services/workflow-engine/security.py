"""Trusted gateway request validation for the workflow service."""

import hmac

from fastapi import Header, HTTPException, status

from config import get_settings


def require_gateway_identity(
    x_axi_internal_token: str | None = Header(default=None),
    x_axi_subject: str | None = Header(default=None),
) -> str:
    settings = get_settings()
    expected = settings.internal_service_token.strip()
    supplied = (x_axi_internal_token or "").strip()
    subject = (x_axi_subject or "").strip()
    if not expected or not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="trusted gateway credential required",
        )
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="verified subject required",
        )
    return subject
