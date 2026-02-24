import React from 'react';
import IconButton from '../../universal/icon-button';
import './style.css';

export interface RightSidebarIconProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Tooltip text */
  tooltip?: string;
  /** Icon size: 'sm'=22px, 'md'=26px */
  size?: 'sm' | 'md';
  /** Whether the icon is active (sidebar expanded) */
  active?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Layout-specific IconButton for right sidebar usage.
 * Uses the universal IconButton component with right-sidebar-specific styling.
 */
const RightSidebarIcon: React.FC<RightSidebarIconProps> = ({
  icon,
  tooltip,
  size = 'md',
  active = false,
  className = '',
  onClick,
}) => {
  return (
    <IconButton
      icon={icon}
      tooltip={tooltip}
      size={size}
      active={active}
      className={`mpms-right-sidebar-icon ${active ? 'is-active' : ''} ${className}`}
      onClick={onClick}
    />
  );
};

export default RightSidebarIcon;
