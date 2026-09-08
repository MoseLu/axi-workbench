import React, { useState, useRef, useEffect } from 'react';
import type { Locale } from '../../../types';
import './style.css';

export interface LocaleSwitcherProps {
  icon: React.ReactNode;
  locale: Locale;
  locales?: { key: Locale; label: string }[];
  onChange?: (locale: Locale) => void;
  tooltip?: string;
}

const defaultLocales: { key: Locale; label: string }[] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en-US', label: 'English' },
];

const LocaleSwitcher: React.FC<LocaleSwitcherProps> = ({
  icon,
  locale,
  locales = defaultLocales,
  onChange,
  tooltip = '国际化',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="mpms-locale-switcher" ref={ref}>
      <button
        className="mpms-icon-btn mpms-icon-btn--md"
        title={tooltip}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {icon}
      </button>
      {open && (
        <div className="mpms-locale-switcher__dropdown">
          {locales.map(l => (
            <div
              key={l.key}
              className={`mpms-locale-switcher__item ${locale === l.key ? 'is-active' : ''}`}
              onClick={() => { onChange?.(l.key); setOpen(false); }}
            >
              {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocaleSwitcher;
