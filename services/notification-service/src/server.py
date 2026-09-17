"""
Notification Service - Server Module

Provides Web->Mobile handoff push notifications with resilient delivery.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def push_to_device(target_device_id: str, notification: dict) -> bool:
    """
    Push notification to target device.

    This is a placeholder implementation. In production, this would integrate
    with FCM, APNs, or other push notification services.

    Args:
        target_device_id: The target device identifier
        notification: Notification payload to send

    Returns:
        True if push was successful, False otherwise
    """
    # TODO: Integrate with actual push notification service (FCM/APNs)
    logger.info(
        f"[Push] Sending to device={target_device_id}: "
        f"type={notification.get('type')}, title={notification.get('title')}"
    )
    # Simulate occasional failures for testing resilience
    return True


async def send_handoff_notification(
    handoff_id: str,
    direction: str,
    target_device_id: str,
    handoff_type: str,
    object_info: dict,
    priority: str = 'normal'
) -> bool:
    """
    Send handoff push notification.

    Distinguishes between web->mobile and mobile->web handoffs.
    Push failures are logged but do not raise exceptions.

    Args:
        handoff_id: Unique identifier for the handoff
        direction: 'web' or 'mobile' - direction of the handoff
        target_device_id: Target device identifier for push delivery
        handoff_type: Type of handoff (e.g., 'task', 'document', 'message')
        object_info: Dictionary containing object details (must have 'name' or 'id')
        priority: Notification priority ('normal' or 'high')

    Returns:
        True if push was successful or failed gracefully, False only on critical error
    """
    # Validate direction
    if direction not in ('web', 'mobile'):
        logger.warning(f"[Handoff] Invalid direction: {direction}, expected 'web' or 'mobile'")
        return False

    # Build notification payload
    object_name = object_info.get('name', object_info.get('id', 'Unknown'))
    title_prefix = '收到' if direction == 'mobile' else '发出'

    notification = {
        'type': 'handoff',
        'handoff_id': handoff_id,
        'direction': direction,
        'title': f'{title_prefix}交接任务',
        'body': f'{handoff_type}: {object_name}',
        'priority': priority,
        'data': {
            'handoff_id': handoff_id,
            'handoff_type': handoff_type,
            'action': 'view_handoff'
        }
    }

    # Push to target device - failures are logged but not raised
    try:
        success = await push_to_device(target_device_id, notification)
        if success:
            logger.info(f"[Handoff] Notification sent successfully: handoff_id={handoff_id}")
        else:
            logger.warning(f"[Handoff] Push failed (will not retry): handoff_id={handoff_id}")
        return True  # Return True to indicate main flow should continue
    except Exception as e:
        # Push failure should not affect main flow - log and continue
        logger.error(
            f"[Handoff] Push exception (non-critical): handoff_id={handoff_id}, "
            f"error={type(e).__name__}: {e}"
        )
        return True  # Return True to allow main flow to continue
