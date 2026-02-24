import React from 'react';
import './style.css';

export interface LogoProps {
  /** Logo image source or icon node */
  icon?: React.ReactNode;
  /** Logo text label */
  text?: string;
  /** Whether the logo is collapsed (sidebar collapsed state) */
  collapsed?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Universal Logo component — consistent styling across all usage contexts.
 * This is a universal atom component with consistent appearance.
 */
const Logo: React.FC<LogoProps> = ({
  icon,
  text = 'MPMS',
  collapsed = false,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`mpms-logo ${collapsed ? 'is-collapsed' : ''} ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {icon && <span className="mpms-logo__icon">{icon}</span>}
      {!collapsed && text && <span className="mpms-logo__text">{text}</span>}
    </div>
  );
};

export default Logo;
