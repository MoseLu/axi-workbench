import React from 'react';
import './style.css';

export interface TopbarProps {
  /** Left section content (e.g., collapse button) */
  left?: React.ReactNode;
  /** Center section content (e.g., global search, top menu) */
  center?: React.ReactNode;
  /** Right section content (e.g., tool icons, user dropdown) */
  right?: React.ReactNode;
  className?: string;
}

const Topbar: React.FC<TopbarProps> = ({
  left,
  center,
  right,
  className = '',
}) => {
  return (
    <header className={`mpms-topbar ${className}`}>
      <div className="mpms-topbar__left">{left}</div>
      {center && <div className="mpms-topbar__center">{center}</div>}
      <div className="mpms-topbar__right">{right}</div>
    </header>
  );
};

export default Topbar;
