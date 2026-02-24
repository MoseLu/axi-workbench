/**
 * useTheme Hook - 主题切换钩子
 * 
 * 提供暗色/亮色主题切换功能
 */
import { useState, useEffect, useCallback, createContext, useContext, ReactNode, FC } from 'react';
import { themes, applyTheme, type DesignTokens, type ThemeMode } from '../styles/tokens';

/**
 * 主题上下文类型
 */
interface ThemeContextValue {
  mode: ThemeMode;
  tokens: DesignTokens;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

/**
 * 主题上下文
 */
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 主题提供者组件
 */
export const ThemeProvider: FC<{
  defaultMode?: ThemeMode;
  children: ReactNode;
}> = ({ defaultMode = 'dark', children }) => {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    const tokens = themes[newMode];
    if (tokens) {
      applyTheme(tokens);
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  // Apply theme on mount
  useEffect(() => {
    const tokens = themes[mode];
    if (tokens) {
      applyTheme(tokens);
    }
  }, [mode]);

  const value: ThemeContextValue = {
    mode,
    tokens: themes[mode],
    setMode,
    toggle,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * 使用主题 hook
 * 
 * @returns 主题状态和切换函数
 * 
 * @example
 * const { mode, tokens, setMode, toggle } = useTheme();
 * 
 * // 切换主题
 * toggle();
 * 
 * // 设置特定主题
 * setMode('light');
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * 使用暗色模式 hook
 * 
 * @returns 是否处于暗色模式
 * 
 * @example
 * const isDark = useDarkMode();
 */
export function useDarkMode() {
  const { mode } = useTheme();
  return mode === 'dark';
}

export default useTheme;
