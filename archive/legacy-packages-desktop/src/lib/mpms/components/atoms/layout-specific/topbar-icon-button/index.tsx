import React from 'react';
import './style.css';

export interface TopbarIconButtonProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Tooltip text */
  tooltip?: string;
  /** Badge count (undefined or 0 means no badge) */
  badge?: number | string;
  /** Whether the item is active */
  active?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Layout-specific IconButton for topbar usage.
 * Styling is customized for topbar context, inheriting from parent Topbar component tokens.
 * This is a layout-specific atom component where styles are provided by the parent molecular component.
 */
const TopbarIconButton: React.FC<TopbarIconButtonProps> = ({
  icon,
  tooltip,
  badge,
  active = false,
  className = '',
  onClick,
}) => {
  return (
    <button
      className={`mpms-topbar-icon-btn ${active ? 'is-active' : ''} ${className}`}
      title={tooltip}
      onClick={onClick}
      type="button"
    >
      {icon}
      {badge !== undefined && badge !== 0 && (
        <span className="mpms-topbar-icon-btn__badge">{badge}</span>
      )}
    </button>
  );
};

export default TopbarIconButton;
