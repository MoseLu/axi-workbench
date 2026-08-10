"""Shared internal event envelope for the workflow consumer boundary."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OutboxEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=128)
    tenant_id: str = Field(default="", alias="tenantId", max_length=128)
    topic: str = Field(min_length=1, max_length=128)
    payload: Any = Field(default_factory=dict)
    producer: str | None = Field(default=None, min_length=1, max_length=64)
    trace_id: str | None = Field(default=None, alias="traceId", min_length=8, max_length=128)
    idempotency_key: str | None = Field(default=None, alias="idempotencyKey", min_length=8, max_length=256)
