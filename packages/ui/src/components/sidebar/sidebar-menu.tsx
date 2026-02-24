import React, { useState } from 'react';
import type { MenuItem } from '../../types';
import './style.css';

export interface SidebarMenuProps {
  items: MenuItem[];
  activeKey?: string;
  collapsed?: boolean;
  onSelect?: (key: string, item: MenuItem) => void;
  renderIcon?: (item: MenuItem) => React.ReactNode;
}

/** Single-column sidebar menu */
const SidebarMenu: React.FC<SidebarMenuProps> = ({
  items,
  activeKey = '',
  collapsed = false,
  onSelect,
  renderIcon,
}) => {
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const toggleOpen = (key: string) => {
    setOpenKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const renderItem = (item: MenuItem, level = 0) => {
    if (item.hidden) return null;
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openKeys.includes(item.key);
    const isActive = activeKey === item.key;

    return (
      <div key={item.key} className="mpms-menu__item-wrap">
        <div
          className={`mpms-menu__item ${isActive ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`}
          style={{ paddingLeft: collapsed ? 0 : 12 + level * 16 }}
          onClick={() => {
            if (item.disabled) return;
            if (hasChildren) {
              toggleOpen(item.key);
            } else {
              onSelect?.(item.key, item);
            }
          }}
        >
          {renderIcon ? renderIcon(item) : item.icon && (
            <span className="mpms-menu__item-icon">{item.icon}</span>
          )}
          {!collapsed && (
            <>
              <span className="mpms-menu__item-label">{item.label}</span>
              {hasChildren && (
                <span className={`mpms-menu__item-arrow ${isOpen ? 'is-open' : ''}`}>
                  ›
                </span>
              )}
            </>
          )}
        </div>
        {hasChildren && isOpen && !collapsed && (
          <div className="mpms-menu__sub">
            {item.children!.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={`mpms-menu ${collapsed ? 'is-collapsed' : ''}`}>
      {items.map(item => renderItem(item))}
    </nav>
  );
};

export default SidebarMenu;
