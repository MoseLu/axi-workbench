import React from 'react';
import type { MenuItem } from '../../types';
import './style.css';

export interface DualMenuProps {
  categories: MenuItem[];
  items: MenuItem[];
  activeCategoryKey?: string;
  activeKey?: string;
  onCategorySelect?: (key: string) => void;
  onSelect?: (key: string, item: MenuItem) => void;
  renderIcon?: (item: MenuItem) => React.ReactNode;
}

/** Dual-column sidebar: left category rail + right sub-menu */
const DualMenu: React.FC<DualMenuProps> = ({
  categories,
  items,
  activeCategoryKey = '',
  activeKey = '',
  onCategorySelect,
  onSelect,
  renderIcon,
}) => {
  return (
    <div className="mpms-dual-menu">
      <div className="mpms-dual-menu__rail">
        {categories.map(cat => (
          <div
            key={cat.key}
            className={`mpms-dual-menu__rail-item ${activeCategoryKey === cat.key ? 'is-active' : ''}`}
            onClick={() => onCategorySelect?.(cat.key)}
            title={cat.label}
          >
            {renderIcon ? renderIcon(cat) : cat.icon && (
              <span className="mpms-dual-menu__rail-icon">{cat.icon}</span>
            )}
            <span className="mpms-dual-menu__rail-label">{cat.label}</span>
          </div>
        ))}
      </div>
      <div className="mpms-dual-menu__panel">
        {items.map(item => (
          <div
            key={item.key}
            className={`mpms-dual-menu__panel-item ${activeKey === item.key ? 'is-active' : ''}`}
            onClick={() => onSelect?.(item.key, item)}
          >
            {renderIcon ? renderIcon(item) : item.icon && (
              <span className="mpms-dual-menu__panel-icon">{item.icon}</span>
            )}
            <span className="mpms-dual-menu__panel-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DualMenu;
