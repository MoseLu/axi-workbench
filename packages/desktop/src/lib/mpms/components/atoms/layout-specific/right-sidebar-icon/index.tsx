import React from 'react';
import './style.css';

export interface RightSidebarIconProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Tooltip text */
  tooltip?: string;
  /** Whether the icon is active (sidebar expanded) */
  active?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Layout-specific Icon for right sidebar usage.
 * Styling is customized for right sidebar context, inheriting from parent RightSidebar component tokens.
 * This is a layout-specific atom component where styles are provided by the parent molecular component.
 */
const RightSidebarIcon: React.FC<RightSidebarIconProps> = ({
  icon,
  tooltip,
  active = false,
  className = '',
  onClick,
}) => {
  return (
    <button
      className={`mpms-right-sidebar-icon ${active ? 'is-active' : ''} ${className}`}
      title={tooltip}
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  );
};

export default RightSidebarIcon;
