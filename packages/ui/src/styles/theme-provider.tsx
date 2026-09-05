import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { DesignTokens, ThemeMode, ThemeConfig } from '../styles/tokens';
import {
  defaultDarkTheme,
  defaultLightTheme,
  applyTheme,
  createTheme,
  generateCSSVariables,
  injectAnimationKeyframes,
} from '../styles/tokens';

/**
 * Theme context value
 * 主题上下文值
 */
interface ThemeContextValue {
  /** Current theme mode */
  mode: ThemeMode;
  /** Current design tokens */
  tokens: DesignTokens;
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Apply custom tokens */
  applyTokens: (tokens: Partial<DesignTokens>) => void;
  /** Reset to default theme */
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Custom hook to use theme
 * 使用主题的自定义钩子
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Theme Provider props
 * 主题提供器属性
 */
export interface ThemeProviderProps {
  /** Initial theme mode */
  initialMode?: ThemeMode;
  /** Custom theme configuration */
  config?: ThemeConfig;
  /** Child components */
  children: React.ReactNode;
}

/**
 * Theme Provider component
 * Provides design tokens context and manages theme state
 * 主题提供器组件，提供设计令牌上下文并管理主题状态
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  initialMode,
  config,
  children,
}) => {
  const resolvedInitialMode = initialMode ?? config?.mode ?? 'dark';
  const [mode, setMode] = useState<ThemeMode>(resolvedInitialMode);
  const [customTokens, setCustomTokens] = useState<Partial<DesignTokens> | null>(config?.tokens ?? null);

  // Calculate current tokens based on mode and custom overrides
  const tokens = useMemo(() => {
    const baseTokens = mode === 'dark' ? defaultDarkTheme : defaultLightTheme;
    if (customTokens) {
      return createTheme(customTokens);
    }
    return baseTokens;
  }, [mode, customTokens]);

  // Apply theme tokens to document
  useEffect(() => {
    applyTheme(tokens);
    injectAnimationKeyframes(tokens.animation);
  }, [tokens]);

  // Context value
  const value: ThemeContextValue = {
    mode,
    tokens,
    setMode: (newMode: ThemeMode) => {
      setMode(newMode);
      setCustomTokens(null);
    },
    applyTokens: (newTokens: Partial<DesignTokens>) => {
      setCustomTokens(newTokens);
    },
    resetTheme: () => {
      setMode(resolvedInitialMode);
      setCustomTokens(null);
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * CSS-only theme switcher component
 * For simple theme switching without JavaScript context
 * CSS-only主题切换器组件，用于不需要JavaScript上下文的简单主题切换
 */
export interface CSSThemeSwitcherProps {
  /** Theme mode to apply */
  mode: 'light' | 'dark';
  children: React.ReactNode;
}

export const CSSThemeSwitcher: React.FC<CSSThemeSwitcherProps> = ({
  mode,
  children,
}) => {
  const theme = mode === 'dark' ? defaultDarkTheme : defaultLightTheme;

  useEffect(() => {
    applyTheme(theme);
    injectAnimationKeyframes(theme.animation);
  }, [theme]);

  return <>{children}</>;
};

/**
 * Theme-aware component helper
 * Creates a component that receives current theme tokens as props
 * 主题感知组件辅助函数，创建一个接收当前主题令牌作为属性的组件
 */
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: DesignTokens }>
): React.FC<P> {
  return (props) => {
    const { tokens } = useTheme();
    return <Component {...props} theme={tokens} />;
  };
}

/**
 * Get CSS variables as a style object
 * Useful for inline styles or CSS-in-JS solutions
 * 获取CSS变量作为样式对象，适用于内联样式或CSS-in-JS解决方案
 */
export function getThemeCSSVariables(mode: ThemeMode = 'dark'): React.CSSProperties {
  const theme = mode === 'dark' ? defaultDarkTheme : defaultLightTheme;

  const colorVars = {
    '--mpms-color-primary': theme.colors.primary,
    '--mpms-color-primary-hover': theme.colors.primaryHover,
    '--mpms-layout-bg': theme.colors.layoutBg,
    '--mpms-sidebar-bg': theme.colors.sidebarBg,
    '--mpms-header-bg': theme.colors.headerBg,
    '--mpms-tabbar-bg': theme.colors.tabbarBg,
    '--mpms-content-bg': theme.colors.contentBg,
    '--mpms-text-primary': theme.colors.textPrimary,
    '--mpms-text-secondary': theme.colors.textSecondary,
    '--mpms-border-color': theme.colors.borderColor,
    '--mpms-hover-bg': theme.colors.hoverBg,
    '--mpms-danger-color': theme.colors.danger,
  };

  return colorVars as React.CSSProperties;
}

/**
 * Generate complete CSS variables string for embedding
 * 生成完整的CSS变量字符串用于嵌入
 */
export function getThemeCSSString(mode: ThemeMode = 'dark'): string {
  const theme = mode === 'dark' ? defaultDarkTheme : defaultLightTheme;
  return generateCSSVariables(theme);
}

export default ThemeProvider;
