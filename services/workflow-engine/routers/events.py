"""Durable platform outbox event receipt."""

import logging

from fastapi import APIRouter, Header, HTTPException, status

from models.events import OutboxEvent
from routers.workflows import get_repository
from security import require_internal_event_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/events", tags=["internal-events"])

AGENT_LIFECYCLE_TOPICS = frozenset(
    {
        "agent.started",
        "agent.progress",
        "agent.result",
        "agent.failed",
        "agent.cancelled",
        "agent.effect_proposed",
        "agent.approval_resumed",
    }
)


def event_actor_subject(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    for key in ("createdBy", "subject", "producer"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def consume_event(
    event: OutboxEvent,
    x_axi_internal_token: str | None = Header(default=None),
    x_axi_event_id: str | None = Header(default=None),
    x_axi_event_topic: str | None = Header(default=None),
    x_axi_event_producer: str | None = Header(default=None),
) -> None:
    require_internal_event_token(x_axi_internal_token)
    if (x_axi_event_id or "").strip() != event.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event id header does not match envelope")
    if (x_axi_event_topic or "").strip() != event.topic:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event topic header does not match envelope")
    if event.topic.startswith("agent."):
        if event.topic not in AGENT_LIFECYCLE_TOPICS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent event topic is not allowed")
        if event.producer != "agent-platform" or (x_axi_event_producer or "").strip() != event.producer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="trusted agent producer required")
        if not event.trace_id or not event.idempotency_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent lifecycle event requires trace and idempotency identifiers")

    try:
        accepted = await get_repository().consume_event(
            event_id=event.id,
            tenant_id=event.tenant_id,
            topic=event.topic,
            payload=event.payload,
            actor_subject=event_actor_subject(event.payload),
        )
    except Exception as exc:
        logger.warning("Could not persist platform event %s: %s", event.id, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="event store unavailable") from exc
    logger.info("Platform event %s %s", event.id, "accepted" if accepted else "already accepted")
