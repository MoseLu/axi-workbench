"""
Tests for notification service - handoff notifications.
"""

import pytest
from unittest.mock import patch, AsyncMock

import sys
sys.path.insert(0, 'src')
from server import send_handoff_notification, push_to_device


class TestHandoffNotification:
    """Test cases for send_handoff_notification function."""

    @pytest.mark.asyncio
    async def test_send_handoff_notification_web_to_mobile(self):
        """Test web->mobile handoff notification is sent correctly."""
        with patch('server.push_to_device', new_callable=AsyncMock) as mock_push:
            mock_push.return_value = True

            result = await send_handoff_notification(
                handoff_id='h123',
                direction='mobile',
                target_device_id='device-001',
                handoff_type='task',
                object_info={'name': 'Review PR #42'},
                priority='normal'
            )

            assert result is True
            mock_push.assert_called_once()
            call_args = mock_push.call_args[0]
            notification = call_args[1]

            assert notification['type'] == 'handoff'
            assert notification['handoff_id'] == 'h123'
            assert notification['direction'] == 'mobile'
            assert '收到' in notification['title']
            assert 'task' in notification['body']

    @pytest.mark.asyncio
    async def test_send_handoff_notification_mobile_to_web(self):
        """Test mobile->web handoff notification is sent correctly."""
        with patch('server.push_to_device', new_callable=AsyncMock) as mock_push:
            mock_push.return_value = True

            result = await send_handoff_notification(
                handoff_id='h456',
                direction='web',
                target_device_id='device-002',
                handoff_type='document',
                object_info={'id': 'doc-789'},
                priority='high'
            )

            assert result is True
            call_args = mock_push.call_args[0]
            notification = call_args[1]

            assert '发出' in notification['title']
            assert notification['priority'] == 'high'

    @pytest.mark.asyncio
    async def test_send_handoff_notification_uses_id_when_name_missing(self):
        """Test that object id is used when name is not available."""
        with patch('server.push_to_device', new_callable=AsyncMock) as mock_push:
            mock_push.return_value = True

            await send_handoff_notification(
                handoff_id='h789',
                direction='mobile',
                target_device_id='device-003',
                handoff_type='message',
                object_info={'id': 'msg-001'},  # No 'name' key
            )

            call_args = mock_push.call_args[0]
            notification = call_args[1]

            assert 'msg-001' in notification['body']

    @pytest.mark.asyncio
    async def test_send_handoff_notification_push_failure_does_not_raise(self):
        """Test that push failure is logged but does not raise exception."""
        with patch('server.push_to_device', new_callable=AsyncMock) as mock_push:
            mock_push.return_value = False

            # Should not raise, should return True to allow main flow to continue
            result = await send_handoff_notification(
                handoff_id='h-fail',
                direction='mobile',
                target_device_id='device-offline',
                handoff_type='task',
                object_info={'name': 'Test Task'},
            )

            assert result is True  # Returns True even on push failure

    @pytest.mark.asyncio
    async def test_send_handoff_notification_exception_does_not_raise(self):
        """Test that push exception is logged but does not raise."""
        with patch('server.push_to_device', new_callable=AsyncMock) as mock_push:
            mock_push.side_effect = ConnectionError("Network unavailable")

            # Should not raise exception
            result = await send_handoff_notification(
                handoff_id='h-error',
                direction='web',
                target_device_id='device-error',
                handoff_type='document',
                object_info={'name': 'Test Doc'},
            )

            # Should return True to allow main flow to continue
            assert result is True

    @pytest.mark.asyncio
    async def test_send_handoff_notification_invalid_direction_returns_false(self):
        """Test that invalid direction returns False."""
        result = await send_handoff_notification(
            handoff_id='h-invalid',
            direction='tablet',  # Invalid direction
            target_device_id='device-001',
            handoff_type='task',
            object_info={'name': 'Test'},
        )

        assert result is False


class TestPushToDevice:
    """Test cases for push_to_device function."""

    @pytest.mark.asyncio
    async def test_push_to_device_returns_true(self):
        """Test that push_to_device returns True on success."""
        result = await push_to_device('device-001', {'type': 'test'})

        assert result is True
