import React from 'react';
import './style.css';

export interface LogoProps {
  icon?: React.ReactNode;
  title?: string;
  collapsed?: boolean;
  onClick?: () => void;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({
  icon,
  title = 'MPMS',
  collapsed = false,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`mpms-logo ${collapsed ? 'is-collapsed' : ''} ${className}`}
      onClick={onClick}
    >
      {icon && <span className="mpms-logo__icon">{icon}</span>}
      {!collapsed && <span className="mpms-logo__title">{title}</span>}
    </div>
  );
};

export default Logo;
