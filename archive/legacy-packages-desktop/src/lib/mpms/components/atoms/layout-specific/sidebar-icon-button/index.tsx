import React from 'react';
import './style.css';

export interface SidebarIconButtonProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Tooltip text */
  tooltip?: string;
  /** Whether the item is active/selected */
  active?: boolean;
  /** Whether sidebar is collapsed */
  collapsed?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Layout-specific IconButton for sidebar usage.
 * Styling is customized for sidebar context, inheriting from parent Sidebar component tokens.
 * This is a layout-specific atom component where styles are provided by the parent molecular component.
 */
const SidebarIconButton: React.FC<SidebarIconButtonProps> = ({
  icon,
  tooltip,
  active = false,
  collapsed = false,
  className = '',
  onClick,
}) => {
  return (
    <button
      className={`mpms-sidebar-icon-btn ${active ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''} ${className}`}
      title={tooltip}
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  );
};

export default SidebarIconButton;
