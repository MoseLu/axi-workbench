import React from 'react';
import IconButton from '../../universal/icon-button';
import './style.css';

export interface TabbarIconProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Icon size: 'sm'=22px, 'md'=26px */
  size?: 'sm' | 'md';
  /** Tooltip text */
  tooltip?: string;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: (e?: React.MouseEvent) => void;
}

/**
 * Layout-specific IconButton for tabbar usage.
 * Uses the universal IconButton component with tabbar-specific styling.
 */
const TabbarIcon: React.FC<TabbarIconProps> = ({
  icon,
  size = 'sm',
  tooltip,
  className = '',
  onClick,
}) => {
  return (
    <IconButton
      icon={icon}
      tooltip={tooltip}
      size={size}
      className={`mpms-tabbar-icon ${className}`}
      onClick={onClick}
    />
  );
};

export default TabbarIcon;
