/**
 * 作业联想输入组件
 */
import React, { useState, useRef } from 'react';
import apiClient from '../api/client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function JobAutocomplete({ value, onChange, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (v: string) => {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length < 1) { setSuggestions([]); setShow(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.suggest(v, 10);
        setSuggestions(data || []);
        setShow((data || []).length > 0);
      } catch { setSuggestions([]); }
    }, 200);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShow(true); }}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder={placeholder || '输入作业名称'}
        style={{
          width: '100%', padding: '8px 10px', fontSize: 14,
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-primary)', color: 'var(--text-primary)',
          boxSizing: 'border-box', outline: 'none',
        }}
      />
      {show && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px var(--shadow-md)',
          zIndex: 100, overflow: 'hidden',
        }}>
          {suggestions.map(s => (
            <div
              key={s}
              onMouseDown={() => { onChange(s); setShow(false); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
