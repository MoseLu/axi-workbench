import React, { useState, useMemo } from 'react';
import type { MenuItem } from '../../types';
import './style.css';

export interface MenuSearchProps {
  items: MenuItem[];
  placeholder?: string;
  onSelect?: (key: string, item: MenuItem) => void;
  collapsed?: boolean;
  /** Search icon rendered in prefix position */
  searchIcon?: React.ReactNode;
}

/** Flatten menu items for search */
function flattenItems(items: MenuItem[], parent?: MenuItem): (MenuItem & { parentLabel?: string })[] {
  return items.reduce<(MenuItem & { parentLabel?: string })[]>((acc, item) => {
    if (item.hidden) return acc;
    acc.push({ ...item, parentLabel: parent?.label });
    if (item.children) {
      acc.push(...flattenItems(item.children, item));
    }
    return acc;
  }, []);
}

const MenuSearch: React.FC<MenuSearchProps> = ({
  items,
  placeholder = '搜索菜单...',
  onSelect,
  collapsed = false,
  searchIcon,
}) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const flatItems = useMemo(() => flattenItems(items), [items]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return flatItems.filter(item =>
      !item.children?.length && item.label.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, flatItems]);

  if (collapsed) return null;

  return (
    <div className="mpms-menu-search">
      <div className="mpms-menu-search__input-wrap">
        {searchIcon && <span className="mpms-menu-search__prefix">{searchIcon}</span>}
        <input
          className="mpms-menu-search__input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
        {query && (
          <span
            className="mpms-menu-search__clear"
            onMouseDown={e => { e.preventDefault(); setQuery(''); }}
          >
            ×
          </span>
        )}
      </div>
      {focused && results.length > 0 && (
        <div className="mpms-menu-search__dropdown">
          {results.map(item => (
            <div
              key={item.key}
              className="mpms-menu-search__dropdown-item"
              onClick={() => {
                onSelect?.(item.key, item);
                setQuery('');
              }}
            >
              {item.parentLabel && (
                <span className="mpms-menu-search__dropdown-parent">{item.parentLabel} / </span>
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuSearch;
