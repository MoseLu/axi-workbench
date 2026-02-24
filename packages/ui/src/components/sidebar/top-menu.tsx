import React from 'react';
import type { MenuItem } from '../../types';
import './style.css';

export interface TopMenuProps {
  items: MenuItem[];
  activeKey?: string;
  onSelect?: (key: string, item: MenuItem) => void;
  renderIcon?: (item: MenuItem) => React.ReactNode;
}

/** Horizontal top menu bar */
const TopMenu: React.FC<TopMenuProps> = ({
  items,
  activeKey = '',
  onSelect,
  renderIcon,
}) => {
  return (
    <nav className="mpms-top-menu">
      {items.map(item => {
        if (item.hidden) return null;
        return (
          <div
            key={item.key}
            className={`mpms-top-menu__item ${activeKey === item.key ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`}
            onClick={() => !item.disabled && onSelect?.(item.key, item)}
          >
            {renderIcon ? renderIcon(item) : item.icon && (
              <span className="mpms-top-menu__item-icon">{item.icon}</span>
            )}
            <span className="mpms-top-menu__item-label">{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
};

export default TopMenu;
