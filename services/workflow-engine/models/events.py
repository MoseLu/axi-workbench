"""Shared internal event envelope for the workflow consumer boundary."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OutboxEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=128)
    tenant_id: str = Field(default="", alias="tenantId", max_length=128)
    topic: str = Field(min_length=1, max_length=128)
    payload: Any = Field(default_factory=dict)
