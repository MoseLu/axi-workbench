"""Durable platform outbox event receipt."""

import logging

from fastapi import APIRouter, Header, HTTPException, status

from models.events import OutboxEvent
from routers.workflows import get_repository
from security import require_internal_event_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/events", tags=["internal-events"])


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def consume_event(
    event: OutboxEvent,
    x_axi_internal_token: str | None = Header(default=None),
    x_axi_event_id: str | None = Header(default=None),
    x_axi_event_topic: str | None = Header(default=None),
) -> None:
    require_internal_event_token(x_axi_internal_token)
    if (x_axi_event_id or "").strip() != event.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event id header does not match envelope")
    if (x_axi_event_topic or "").strip() != event.topic:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="event topic header does not match envelope")

    try:
        accepted = await get_repository().consume_event(
            event_id=event.id,
            tenant_id=event.tenant_id,
            topic=event.topic,
            payload=event.payload,
        )
    except Exception as exc:
        logger.warning("Could not persist platform event %s: %s", event.id, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="event store unavailable") from exc
    logger.info("Platform event %s %s", event.id, "accepted" if accepted else "already accepted")
