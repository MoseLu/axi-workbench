/**
 * 工作台登录页 — 邮箱后缀下拉选择组件。
 *
 * 行为保持与原 Login.tsx 内联实现一致：点击唤出 listbox，外部点击/Esc 关闭，
 * 选项回写 onChange；外部 test 通过 aria 角色定位元素。
 */
import React, { useEffect, useRef, useState } from 'react';

export const EMAIL_SUFFIX_OPTIONS = [
  'qq.com',
  '163.com',
  'gmail.com',
  'outlook.com',
  'axiomaticworld.com',
] as const;

export type EmailSuffix = (typeof EMAIL_SUFFIX_OPTIONS)[number];

export const DEFAULT_EMAIL_SUFFIX: EmailSuffix = 'qq.com';

export interface EmailSuffixSelectProps {
  id: string;
  value: EmailSuffix;
  disabled?: boolean;
  label: string;
  onChange: (value: EmailSuffix) => void;
}

function EmailSuffixSelect({
  id,
  value,
  disabled,
  label,
  onChange,
}: EmailSuffixSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = `${id}-list`;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`axi-login-email-suffix-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        id={id}
        className="axi-login-email-suffix"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-value={value}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="axi-login-email-suffix-value">@{value}</span>
        <svg className="axi-login-email-suffix-chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.4 4.2 L6 8 L9.6 4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul id={listId} className="axi-login-email-suffix-menu" role="listbox" aria-label={label}>
          {EMAIL_SUFFIX_OPTIONS.map((suffix) => (
            <li
              key={suffix}
              role="option"
              aria-selected={suffix === value}
              className={`axi-login-email-suffix-option${suffix === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(suffix);
                setOpen(false);
              }}
            >
              @{suffix}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default EmailSuffixSelect;
