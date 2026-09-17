import React from 'react';
import './style.css';

export interface TabbarIconProps {
  /** Icon name (will be passed to Icon component) or icon node */
  name?: string;
  /** Icon element to display (alternative to name) */
  icon?: React.ReactNode;
  /** Icon size */
  size?: number;
  /** Tooltip text */
  tooltip?: string;
  /** Custom CSS class */
  className?: string;
  /** Click handler */
  onClick?: (e?: React.MouseEvent) => void;
}

/**
 * Layout-specific Icon for tabbar usage.
 * Styling is customized for tabbar context, inheriting from parent TabBar component tokens.
 * This is a layout-specific atom component where styles are provided by the parent molecular component.
 */
const TabbarIcon: React.FC<TabbarIconProps> = ({
  name,
  icon,
  size = 14,
  tooltip,
  className = '',
  onClick,
}) => {
  const style: React.CSSProperties = {
    display: 'inline-block',
    width: size,
    height: size,
    backgroundColor: 'currentColor',
    flexShrink: 0,
  };

  const content = icon || (name && <span style={style} className={`mpms-tabbar-icon ${className}`} role="img" aria-label={name} />);

  return (
    <span
      className={`mpms-tabbar-icon-wrapper ${className}`}
      title={tooltip}
      onClick={onClick}
      role="button"
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {content}
    </span>
  );
};

export default TabbarIcon;
