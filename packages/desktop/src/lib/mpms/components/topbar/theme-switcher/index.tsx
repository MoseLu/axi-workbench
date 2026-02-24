import React from 'react';
import type { ThemeMode } from '../../../types';

export interface ThemeSwitcherProps {
  icon: React.ReactNode;
  theme: ThemeMode;
  onChange?: (theme: ThemeMode) => void;
  tooltip?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  icon,
  theme,
  onChange,
  tooltip = '主题切换',
}) => (
  <button
    className="mpms-icon-btn mpms-icon-btn--md"
    title={tooltip}
    onClick={() => onChange?.(theme === 'dark' ? 'light' : 'dark')}
    type="button"
  >
    {icon}
  </button>
);

export default ThemeSwitcher;
