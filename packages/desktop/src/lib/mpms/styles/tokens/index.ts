/**
 * Design Tokens System
 * 设计令牌系统
 *
 * This module provides a comprehensive design token system for the MPMS UI library.
 * It includes color, spacing, typography, size, and animation tokens with full
 * TypeScript type safety and CSS variable generation capabilities.
 *
 * 本模块为MPMS UI库提供完整的设计令牌系统，包含颜色、间距、排版、尺寸和动画令牌，
 * 具有完整的TypeScript类型安全和CSS变量生成功能。
 */

// Re-export all token modules
export * from './colors';
export * from './spacing';
export * from './typography';
export * from './sizes';
export * from './animation';

// Import color tokens for themes
import { defaultDarkColors, defaultLightColors } from './colors';

// Import generate functions for use in this file
import { generateColorCSSVariables } from './colors';
import { generateSpacingCSSVariables } from './spacing';
import { generateTypographyCSSVariables } from './typography';
import { generateSizeCSSVariables } from './sizes';
import { generateAnimationCSSVariables, injectAnimationKeyframes } from './animation';

// ========== Main Design Tokens Interface ==========

/**
 * Complete design tokens interface combining all token categories
 * 完整的设计令牌接口，包含所有令牌类别
 */
export interface DesignTokens {
  /** Color tokens - 颜色令牌 */
  colors: import('./colors').ColorTokens;
  /** Spacing tokens - 间距令牌 */
  spacing: import('./spacing').SpacingTokens;
  /** Typography tokens - 排版令牌 */
  typography: import('./typography').TypographyTokens;
  /** Size tokens - 尺寸令牌 */
  sizes: import('./sizes').SizeTokens;
  /** Animation tokens - 动画令牌 */
  animation: import('./animation').AnimationTokens;
}

// ========== Default Theme ==========

/**
 * Default dark theme tokens
 * 默认暗色主题令牌
 */
export const defaultDarkTheme: DesignTokens = {
  colors: {
    // Primary colors
    primary: '#4165d7',
    primaryHover: '#5a7de0',
    primaryActive: '#3451b8',

    // Layout background colors
    layoutBg: '#0a0a0a',
    sidebarBg: '#0a0a0a',
    headerBg: '#0a0a0a',
    tabbarBg: '#0a0a0a',
    rightSidebarBg: '#0a0a0a',
    contentBg: '#141414',
    contentElevated: '#1e1e1e',

    // Text colors
    textPrimary: 'rgba(255, 255, 255, 0.85)',
    textSecondary: 'rgba(255, 255, 255, 0.45)',
    textTertiary: 'rgba(255, 255, 255, 0.25)',
    textDisabled: 'rgba(255, 255, 255, 0.18)',

    // Border colors
    borderColor: '#2b2b2c',
    borderLight: '#3a3a3c',

    // Status colors
    success: '#52c41a',
    warning: '#faad14',
    error: '#f5222d',
    info: '#1890ff',

    // Interactive states
    hoverBg: 'rgba(255, 255, 255, 0.06)',
    activeBg: 'rgba(255, 255, 255, 0.10)',

    // Danger
    danger: '#f5222d',
    dangerHover: '#ff4d4f',
    dangerBg: 'rgba(245, 34, 45, 0.15)',
  },

  spacing: {
    // Base spacing scale
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',

    // Component-specific spacing
    sidebarWidth: '220px',
    sidebarCollapsedWidth: '64px',
    headerHeight: '46px',
    tabbarHeight: '40px',
    rightSidebarWidth: '46px',

    // Padding
    paddingXs: '4px',
    paddingSm: '8px',
    paddingMd: '12px',
    paddingLg: '16px',

    // Gap
    gapXs: '4px',
    gapSm: '8px',
    gapMd: '12px',
    gapLg: '16px',
  },

  typography: {
    // Font families
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyMono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',

    // Font sizes
    fontSizeXs: '10px',
    fontSizeSm: '12px',
    fontSizeMd: '14px',
    fontSizeLg: '16px',
    fontSizeXl: '18px',
    fontSizeXxl: '20px',

    // Font weights
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightSemibold: 600,
    fontWeightBold: 700,

    // Line heights
    lineHeightTight: 1.25,
    lineHeightNormal: 1.5,
    lineHeightRelaxed: 1.75,

    // Letter spacing
    letterSpacingTight: '-0.02em',
    letterSpacingNormal: '0',
    letterSpacingWide: '0.02em',
  },

  sizes: {
    // Icon sizes
    iconXs: 12,
    iconSm: 14,
    iconMd: 16,
    iconLg: 20,
    iconXl: 24,

    // Button heights
    buttonHeightSm: 22,
    buttonHeightMd: 26,
    buttonHeightLg: 32,

    // Border radius
    radiusXs: '2px',
    radiusSm: '4px',
    radiusMd: '6px',
    radiusLg: '8px',
    radiusFull: '9999px',

    // Border width
    borderWidthSm: 1,
    borderWidthMd: 1,
    borderWidthLg: 2,

    // Z-index scale
    zIndexDropdown: 1000,
    zIndexSticky: 1020,
    zIndexFixed: 1030,
    zIndexModalBackdrop: 1040,
    zIndexModal: 1050,
    zIndexPopover: 1060,
    zIndexTooltip: 1070,
  },

  animation: {
    // Durations (in milliseconds)
    durationFast: 100,
    durationNormal: 200,
    durationSlow: 300,

    // Easing functions
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.2, 1)',

    // Keyframes (CSS keyframe definitions)
    fadeIn: `
      from { opacity: 0; }
      to { opacity: 1; }
    `,
    fadeOut: `
      from { opacity: 1; }
      to { opacity: 0; }
    `,
    slideInUp: `
      from {
        transform: translateY(10px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    `,
    slideOutDown: `
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(10px);
        opacity: 0;
      }
    `,
    scaleIn: `
      from {
        transform: scale(0.95);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    `,
    scaleOut: `
      from {
        transform: scale(1);
        opacity: 1;
      }
      to {
        transform: scale(0.95);
        opacity: 0;
      }
    `,
  },
};

/**
 * Theme mode type
 * 主题模式类型
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Theme configuration
 * 主题配置
 */
export interface ThemeConfig {
  mode: ThemeMode;
  tokens?: Partial<DesignTokens>;
}

// ========== CSS Variable Generation ==========

/**
 * Generate complete CSS variables string from design tokens
 * 从设计令牌生成完整的CSS变量字符串
 */
export function generateCSSVariables(tokens: DesignTokens): string {
  const colorVars = generateColorCSSVariables(tokens.colors);
  const spacingVars = generateSpacingCSSVariables(tokens.spacing);
  const typographyVars = generateTypographyCSSVariables(tokens.typography);
  const sizeVars = generateSizeCSSVariables(tokens.sizes);
  const animationVars = generateAnimationCSSVariables(tokens.animation);

  const allVars = {
    ...colorVars,
    ...spacingVars,
    ...typographyVars,
    ...sizeVars,
    ...animationVars,
  };

  const varStrings = Object.entries(allVars).map(([key, value]) => {
    return `  ${key}: ${value};`;
  });

  return `:root {\n${varStrings.join('\n')}\n}`;
}

/**
 * Apply design tokens to the document root
 * 将设计令牌应用到文档根元素
 */
export function applyTheme(tokens: DesignTokens): void {
  if (typeof document === 'undefined') return;

  const css = generateCSSVariables(tokens);
  const styleId = 'mpms-design-tokens';

  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }

  style.textContent = css;

  // Also inject animation keyframes
  injectAnimationKeyframes(tokens.animation);
}

// ========== Theme Factory ==========

/**
 * Create a custom theme by merging with a base theme
 * 通过与基础主题合并创建自定义主题
 */
export function createTheme(
  overrides: Partial<DesignTokens>,
  base: 'dark' | 'light' = 'dark'
): DesignTokens {
  const baseTheme = base === 'light' ? themes.light : defaultDarkTheme;
  return {
    colors: { ...baseTheme.colors, ...overrides.colors },
    spacing: { ...baseTheme.spacing, ...overrides.spacing },
    typography: { ...baseTheme.typography, ...overrides.typography },
    sizes: { ...baseTheme.sizes, ...overrides.sizes },
    animation: { ...baseTheme.animation, ...overrides.animation },
  };
}

/**
 * Predefined themes
 * 预定义主题
 */
export const themes: Record<string, DesignTokens> = {
  dark: defaultDarkTheme,
  light: {
    ...defaultDarkTheme,
    colors: defaultLightColors,
  },
};

/**
 * Default light theme tokens (re-exported for convenience)
 * 默认亮色主题令牌（为方便使用而重新导出）
 */
export const defaultLightTheme: DesignTokens = themes.light;

/**
 * Get theme by name
 * 根据名称获取主题
 */
export function getTheme(name: string): DesignTokens {
  return themes[name] || defaultDarkTheme;
}
