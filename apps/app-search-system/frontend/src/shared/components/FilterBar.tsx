/**
 * 搜索筛选栏 - 机型 + 工序 二维度筛选
 * 机型 (machine_type) → 工序 (process)
 */
import React, { useState, useEffect, useRef } from 'react';
import apiClient, { FilterOptions } from '../api/client';

interface FilterBarProps {
  value: { category: string; sub_category: string; process: string };
  onChange: (filters: { category: string; sub_category: string; process: string }) => void;
}

export default function FilterBar({ value, onChange }: FilterBarProps) {
  const [options, setOptions] = useState<FilterOptions>({
    categories: [],
    sub_categories: [],
    processes: [],
    machines: [],
  });

  // 机型输入状态
  const [machineInput, setMachineInput] = useState(value.sub_category);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const machineInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载筛选项
  useEffect(() => {
    let cancelled = false;
    apiClient.filterOptions().then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => { cancelled = true; };
  }, []);

  // 同步外部选中值到本地输入状态
  useEffect(() => {
    setMachineInput(value.sub_category);
  }, [value.sub_category]);

  // 点击外部关闭机型下拉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMachineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 机型下拉过滤（输入即搜）
  const filteredMachines = machineInput.trim()
    ? options.sub_categories.filter(m =>
        m.toLowerCase().includes(machineInput.toLowerCase())
      )
    : options.sub_categories;

  const selectMachine = (m: string) => {
    setMachineInput(m);
    setShowMachineDropdown(false);
    onChange({ category: value.category, sub_category: m, process: '' });
  };

  const handleMachineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowMachineDropdown(false);
      // 如果输入的值正好匹配一个选项，选中它
      const exact = options.sub_categories.find(
        m => m.toLowerCase() === machineInput.toLowerCase()
      );
      if (exact) {
        onChange({ category: value.category, sub_category: exact, process: '' });
      } else if (machineInput.trim()) {
        // 模糊匹配第一个
        const first = filteredMachines[0];
        if (first) selectMachine(first);
      }
    } else if (e.key === 'Escape') {
      setShowMachineDropdown(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowMachineDropdown(true);
    } else if (e.key === 'Tab') {
      setShowMachineDropdown(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: '0 12px',
    fontSize: 14,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 160,
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0',
        flexWrap: 'wrap',
      }}
    >
      {/* 筛选控件组（占据左侧，撑满中间空间） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        {/* 机型（可输入搜索的下拉） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={machineInputRef}
              value={machineInput}
              onChange={e => {
                setMachineInput(e.target.value);
                setShowMachineDropdown(true);
              }}
              onFocus={() => setShowMachineDropdown(true)}
              onKeyDown={handleMachineKeyDown}
              placeholder="全部机型"
              aria-label="机型筛选"
              style={{
                ...inputStyle,
                cursor: 'text',
                minWidth: 180,
              }}
            />
          {/* 下拉箭头指示 */}
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 10,
          }}>▼</span>

          {/* 下拉选项 */}
          {showMachineDropdown && filteredMachines.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 8px 24px var(--shadow)',
              zIndex: 200, maxHeight: 240, overflowY: 'auto',
            }}>
              {filteredMachines.map(m => (
                <div
                  key={m}
                  onMouseDown={() => selectMachine(m)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {m}
                </div>
              ))}
            </div>
          )}
          {showMachineDropdown && filteredMachines.length === 0 && machineInput.trim() && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 8px 24px var(--shadow)',
              zIndex: 200, padding: '8px 12px', fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              无匹配机型
            </div>
          )}
        </div>
        </div>

        {/* 工序（普通下拉） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <select
            value={value.process}
            onChange={(e) => onChange({ category: value.category, sub_category: value.sub_category, process: e.target.value })}
            style={{
              height: 36,
              padding: '0 12px',
              fontSize: 14,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              outline: 'none',
              minWidth: 120,
            }}
          >
            <option value="">全部工序</option>
            {options.processes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
