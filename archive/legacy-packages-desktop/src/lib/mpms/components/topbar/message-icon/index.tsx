import React from 'react';
import NotificationIcon from '../notification-icon';
import type { NoticeItem } from '../../../types';

export interface MessageIconProps {
  icon: React.ReactNode;
  items?: NoticeItem[];
  count?: number;
  tooltip?: string;
  onItemClick?: (item: NoticeItem) => void;
  onViewAll?: () => void;
}

/** Message icon — same structure as NotificationIcon with different defaults */
const MessageIcon: React.FC<MessageIconProps> = ({
  tooltip = '消息',
  ...props
}) => <NotificationIcon tooltip={tooltip} {...props} />;

export default MessageIcon;
