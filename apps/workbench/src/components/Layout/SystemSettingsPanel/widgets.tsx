/**
 * 设置面板 UI 控件：
 *   - copy()        按 locale 选词
 *   - SettingRow    行容器（label / 描述 / 控件）
 *   - Toggle        开关按钮
 *   - OptionGroup   单选按钮组
 *   - ActionButton  跳转操作按钮
 *   - ShortcutList  快捷键列表
 *
 * 不修改业务逻辑；只搬代码 + 调整 import 路径。
 */
import React from 'react';

import { AxiSvgIcon, type AxiIconName } from "@axi/icons";

export function copy(locale: 'zh-CN' | 'en-US', zh: string, en: string): string {
  return locale === 'zh-CN' ? zh : en;
}

export function SettingRow({
  control,
  description,
  label,
}: {
  control: React.ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="wb-system-settings__row">
      <div className="wb-system-settings__row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <div className="wb-system-settings__row-control">{control}</div>
    </div>
  );
}

export function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`wb-system-settings__toggle${checked ? ' is-on' : ''}`}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function OptionGroup({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div aria-label={ariaLabel} className="wb-system-settings__options" role="radiogroup">
      {options.map((option) => (
        <button
          aria-checked={value === option.value}
          className={value === option.value ? 'is-active' : ''}
          key={option.value}
          role="radio"
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ActionButton({
  iconName,
  label,
  onClick,
}: {
  iconName: AxiIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="wb-system-settings__action" type="button" onClick={onClick}>
      <span>{label}</span>
      <AxiSvgIcon name={iconName} size={15} />
    </button>
  );
}

export function ShortcutList({
  rows,
}: {
  rows: ReadonlyArray<{ description: string; label: string; shortcut: string }>;
}) {
  return (
    <div className="wb-system-settings__shortcut-list">
      {rows.map(({ description, label, shortcut }) => (
        <SettingRow
          control={<kbd>{shortcut}</kbd>}
          description={description}
          key={label}
          label={label}
        />
      ))}
    </div>
  );
}