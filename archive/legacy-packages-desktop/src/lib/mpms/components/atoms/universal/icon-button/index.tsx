import React from 'react';
import './style.css';

export interface IconButtonProps {
  icon: React.ReactNode;
  tooltip?: string;
  badge?: number | string;
  active?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

/**
 * Universal IconButton component — consistent styling across all usage contexts.
 * This is a universal atom component where all usage has identical styling.
 * The styling is provided by the component definition itself.
 */
const IconButton: React.FC<IconButtonProps> = ({
  icon,
  tooltip,
  badge,
  active = false,
  size = 'md',
  onClick,
  className = '',
}) => {
  return (
    <button
      className={`mpms-icon-btn mpms-icon-btn--${size} ${active ? 'is-active' : ''} ${className}`}
      title={tooltip}
      onClick={onClick}
      type="button"
    >
      {icon}
      {badge !== undefined && badge !== 0 && (
        <span className="mpms-icon-btn__badge">{badge}</span>
      )}
    </button>
  );
};

export default IconButton;
