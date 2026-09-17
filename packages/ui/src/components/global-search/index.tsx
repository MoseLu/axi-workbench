import React, { useState, useRef, useEffect } from 'react';
import type { MenuItem } from '../../types';
import './style.css';

export interface GlobalSearchProps {
  items: MenuItem[];
  placeholder?: string;
  onSelect?: (key: string, item: MenuItem) => void;
  hotkey?: string;
}

function flattenAll(items: MenuItem[], path: string[] = []): { item: MenuItem; path: string[] }[] {
  return items.reduce<{ item: MenuItem; path: string[] }[]>((acc, item) => {
    if (item.hidden) return acc;
    const currentPath = [...path, item.label];
    if (!item.children?.length) {
      acc.push({ item, path: currentPath });
    }
    if (item.children) {
      acc.push(...flattenAll(item.children, currentPath));
    }
    return acc;
  }, []);
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  items,
  placeholder = '搜索菜单 (Ctrl+K)',
  onSelect,
  hotkey = 'k',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = React.useMemo(() => flattenAll(items), [items]);
  const results = React.useMemo(() => {
    if (!query.trim()) return flat.slice(0, 8);
    const q = query.toLowerCase();
    return flat.filter(f => f.item.label.toLowerCase().includes(q) || f.path.join('/').toLowerCase().includes(q)).slice(0, 10);
  }, [query, flat]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === hotkey) {
        e.preventDefault();
        setQuery('');
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hotkey]);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!open) return null;

  return (
    <div className="mpms-global-search__mask" onClick={() => setOpen(false)}>
      <div className="mpms-global-search" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="mpms-global-search__input"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="mpms-global-search__results">
          {results.map(r => (
            <div
              key={r.item.key}
              className="mpms-global-search__result-item"
              onClick={() => { onSelect?.(r.item.key, r.item); setOpen(false); }}
            >
              <span className="mpms-global-search__result-path">{r.path.slice(0, -1).join(' / ')}</span>
              <span className="mpms-global-search__result-label">{r.item.label}</span>
            </div>
          ))}
          {results.length === 0 && (
            <div className="mpms-global-search__empty">无匹配结果</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
