import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AxiSvgIcon, type AxiIconName } from '@axi/core';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import './GlobalSearchDialog.css';

export type GlobalSearchItem = {
  key: string;
  label: string;
  description: string;
  group: string;
  path: string;
  iconName: AxiIconName;
};

type GlobalSearchDialogProps = {
  open: boolean;
  query: string;
  items: GlobalSearchItem[];
  recentItems: GlobalSearchItem[];
  onChange: (value: string) => void;
  onClose: () => void;
  onSelect: (item: GlobalSearchItem) => void;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return text;
  const matcher = new RegExp(`(${escapeRegExp(needle)})`, 'ig');
  return text.split(matcher).map((part, index) => (
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  ));
}

const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({
  open,
  query,
  items,
  recentItems,
  onChange,
  onClose,
  onSelect,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return recentItems;
    return items.filter((item) =>
      [item.label, item.description, item.group].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [items, query, recentItems]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, GlobalSearchItem[]>();
    filteredItems.forEach((item) => {
      const group = groups.get(item.group) ?? [];
      group.push(item);
      groups.set(item.group, group);
    });
    return Array.from(groups.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
  }, [filteredItems]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filteredItems.length - 1, 0)));
  }, [filteredItems.length]);

  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open || typeof document === 'undefined') return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => filteredItems.length ? (index + 1) % filteredItems.length : 0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => filteredItems.length ? (index - 1 + filteredItems.length) % filteredItems.length : 0);
      return;
    }
    if (event.key === 'Enter' && filteredItems[activeIndex]) {
      event.preventDefault();
      onSelect(filteredItems[activeIndex]);
    }
  };

  let flatIndex = 0;

  return createPortal(
    <div className="wb-global-search" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="wb-global-search__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-global-search-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="wb-global-search__header">
          <div className="wb-global-search__field">
            <AxiSvgIcon name={axiWorkbenchIconMap.search} size={18} className="wb-global-search__search-icon" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索页面、项目、文档或内容"
              aria-label="全局搜索"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button type="button" className="wb-global-search__clear" onClick={() => onChange('')} aria-label="清除搜索">
                <AxiSvgIcon name={axiWorkbenchIconMap.close} size={14} />
              </button>
            ) : (
              <kbd className="wb-global-search__enter-key">Enter</kbd>
            )}
          </div>
          <button type="button" className="wb-global-search__close" onClick={onClose} aria-label="关闭全局搜索">
            <AxiSvgIcon name={axiWorkbenchIconMap.close} size={16} />
            <kbd>Esc</kbd>
          </button>
        </header>

        <div className="wb-global-search__body">
          <div className="wb-global-search__meta">
            <div>
              <span id="wb-global-search-title" className="wb-global-search__title">
                {query.trim() ? '匹配到的结果' : '最近访问与快捷入口'}
              </span>
              <span className="wb-global-search__count">{filteredItems.length} 项</span>
            </div>
            <span className="wb-global-search__hint">输入关键词开始搜索</span>
          </div>

          {groupedItems.length > 0 ? (
            <div className="wb-global-search__results" role="listbox" aria-label="搜索结果">
              {groupedItems.map((group) => (
                <div className="wb-global-search__group" key={group.label}>
                  <div className="wb-global-search__group-label">{group.label}</div>
                  {group.items.map((item) => {
                    const itemIndex = flatIndex;
                    flatIndex += 1;
                    const active = itemIndex === activeIndex;
                    return (
                      <button
                        ref={(element) => { rowRefs.current[itemIndex] = element; }}
                        key={item.key}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`wb-global-search__result ${active ? 'is-active' : ''}`}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => onSelect(item)}
                      >
                        <span className="wb-global-search__result-icon">
                          <AxiSvgIcon name={item.iconName} size={17} />
                        </span>
                        <span className="wb-global-search__result-copy">
                          <span className="wb-global-search__result-label">
                            {highlightText(item.label, query)}
                          </span>
                          <span className="wb-global-search__result-description">
                            {highlightText(item.description, query)}
                          </span>
                        </span>
                        <span className="wb-global-search__result-group">{item.group}</span>
                        <AxiSvgIcon name={axiWorkbenchIconMap.forward} size={14} className="wb-global-search__result-arrow" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="wb-global-search__empty">
              <span className="wb-global-search__empty-icon"><AxiSvgIcon name={axiWorkbenchIconMap.search} size={22} /></span>
              <strong>没有找到匹配结果</strong>
              <span>试试搜索“项目”、“文档”或“设计”</span>
            </div>
          )}
        </div>

        <footer className="wb-global-search__footer">
          <div className="wb-global-search__keys">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>Enter</kbd> 打开</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default GlobalSearchDialog;
