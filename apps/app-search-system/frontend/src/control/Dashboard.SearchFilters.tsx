/**
 * Dashboard.SearchFilters —— 搜索筛选栏(分类 / 机型 / 工序 / 关键词 + ComboBox)。
 * 从原 Dashboard.tsx 中抽出,保留原行为与下拉交互逻辑。
 */
import React, { useState, useEffect, useRef } from 'react';

export interface FilterOptions {
  processes: string[];
  categories: string[];
  machines: string[];
}

export interface SearchFiltersProps {
  filters: { process: string; category: string; machine: string };
  filterOptions: FilterOptions;
  query: string;
  searchLoading: boolean;
  filterWrapRef: React.RefObject<HTMLDivElement>;
  onCategoryChange: (value: string) => void;
  onMachineChange: (value: string) => void;
  onProcessChange: (value: string) => void;
  onQueryChange: (value: string) => void;
}

interface ComboBoxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  extraStyle?: React.CSSProperties;
}

function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  open,
  setOpen,
  inputRef,
  extraStyle,
}: ComboBoxProps) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);

  const filtered = text.trim()
    ? options.filter(o => o.toLowerCase().includes(text.toLowerCase()))
    : options;

  const comboStyle: React.CSSProperties = {
    position: 'relative',
    flexShrink: 0,
  };
  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: '0 32px 0 10px',
    fontSize: 13,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 110,
  };
  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: 'var(--text-muted)',
    fontSize: 10,
  };
  const dropStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: '0 8px 24px var(--shadow)',
    zIndex: 200,
    maxHeight: 240,
    overflowY: 'auto',
  };
  const itemStyle: React.CSSProperties = {
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{ ...comboStyle, ...(extraStyle || {}) }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setText(value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setOpen(false);
              onChange(text);
            }
            if (e.key === 'Escape') {
              setOpen(false);
              setText(value);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          style={{ ...inputStyle, cursor: 'text', width: (extraStyle?.minWidth as number) || 110 }}
        />
        <span style={arrowStyle}>▼</span>
      </div>
      {open && filtered.length > 0 && (
        <div style={dropStyle} onMouseDown={e => e.preventDefault()}>
          {filtered.map(o => (
            <div
              key={o}
              onClick={() => {
                onChange(o);
                setText(o);
                setOpen(false);
              }}
              style={itemStyle}
              onMouseEnter={e =>
                ((e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)')
              }
              onMouseLeave={e =>
                ((e.currentTarget as HTMLElement).style.background = 'transparent')
              }
            >
              {o}
            </div>
          ))}
        </div>
      )}
      {open && text.trim() && filtered.length === 0 && (
        <div
          style={{
            ...dropStyle,
            padding: '8px 10px',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}
        >
          无匹配
        </div>
      )}
    </div>
  );
}

export default function SearchFilters({
  filters,
  filterOptions,
  query,
  searchLoading,
  filterWrapRef,
  onCategoryChange,
  onMachineChange,
  onProcessChange,
  onQueryChange,
}: SearchFiltersProps) {
  const [catOpen, setCatOpen] = useState(false);
  const [machOpen, setMachOpen] = useState(false);
  const [procOpen, setProcOpen] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);
  const machInputRef = useRef<HTMLInputElement>(null);
  const procInputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭所有下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setCatOpen(false);
        setMachOpen(false);
        setProcOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterWrapRef]);

  return (
    <div
      ref={filterWrapRef}
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* 分类（一级） */}
      <ComboBox
        value={filters.category}
        onChange={v => {
          onCategoryChange(v);
        }}
        options={filterOptions.categories || []}
        placeholder="分类"
        open={catOpen}
        setOpen={setCatOpen}
        inputRef={catInputRef}
        extraStyle={{ minWidth: 110 }}
      />

      {/* 机型（二级） */}
      <ComboBox
        value={filters.machine}
        onChange={v => {
          onMachineChange(v);
        }}
        options={filterOptions.machines || []}
        placeholder="机型"
        open={machOpen}
        setOpen={setMachOpen}
        inputRef={machInputRef}
        extraStyle={{ minWidth: 130 }}
      />

      {/* 工序（三级） */}
      <ComboBox
        value={filters.process}
        onChange={v => {
          onProcessChange(v);
        }}
        options={filterOptions.processes || []}
        placeholder="工序"
        open={procOpen}
        setOpen={setProcOpen}
        inputRef={procInputRef}
        extraStyle={{ minWidth: 110 }}
      />

      {/* 关键词 */}
      <input
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder="搜索关键词"
        style={{
          flex: 1,
          height: 36,
          padding: '0 10px',
          fontSize: 13,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />

      {/* 搜索加载指示器 */}
      {searchLoading && (
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}
