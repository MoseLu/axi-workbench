/**
 * Color Design Tokens
 * 颜色设计令牌
 */

export interface ColorTokens {
  // Primary colors
  primary: string;
  primaryHover: string;
  primaryActive: string;

  // Layout background colors
  layoutBg: string;
  sidebarBg: string;
  headerBg: string;
  tabbarBg: string;
  rightSidebarBg: string;
  contentBg: string;
  contentElevated: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;

  // Border colors
  borderColor: string;
  borderLight: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Interactive states
  hoverBg: string;
  activeBg: string;

  // Danger
  danger: string;
  dangerHover: string;
  dangerBg: string;
}

export const defaultDarkColors: ColorTokens = {
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
};

export const defaultLightColors: ColorTokens = {
  // Primary colors
  primary: '#4165d7',
  primaryHover: '#5a7de0',
  primaryActive: '#3451b8',

  // Layout background colors
  layoutBg: '#ffffff',
  sidebarBg: '#f5f5f5',
  headerBg: '#ffffff',
  tabbarBg: '#fafafa',
  rightSidebarBg: '#fafafa',
  contentBg: '#f5f5f5',
  contentElevated: '#ffffff',

  // Text colors
  textPrimary: 'rgba(0, 0, 0, 0.85)',
  textSecondary: 'rgba(0, 0, 0, 0.45)',
  textTertiary: 'rgba(0, 0, 0, 0.25)',
  textDisabled: 'rgba(0, 0, 0, 0.18)',

  // Border colors
  borderColor: '#d9d9d9',
  borderLight: '#e8e8e8',

  // Status colors
  success: '#52c41a',
  warning: '#faad14',
  error: '#f5222d',
  info: '#1890ff',

  // Interactive states
  hoverBg: 'rgba(0, 0, 0, 0.04)',
  activeBg: 'rgba(0, 0, 0, 0.08)',

  // Danger
  danger: '#f5222d',
  dangerHover: '#ff4d4f',
  dangerBg: 'rgba(245, 34, 45, 0.10)',
};

/**
 * Generate CSS color variables from color tokens
 * 从颜色令牌生成CSS颜色变量
 */
export function generateColorCSSVariables(tokens: ColorTokens): Record<string, string> {
  return {
    '--mpms-color-primary': tokens.primary,
    '--mpms-color-primary-hover': tokens.primaryHover,
    '--mpms-color-primary-active': tokens.primaryActive,

    '--mpms-layout-bg': tokens.layoutBg,
    '--mpms-sidebar-bg': tokens.sidebarBg,
    '--mpms-header-bg': tokens.headerBg,
    '--mpms-tabbar-bg': tokens.tabbarBg,
    '--mpms-right-sidebar-bg': tokens.rightSidebarBg,
    '--mpms-content-bg': tokens.contentBg,
    '--mpms-content-elevated': tokens.contentElevated,

    '--mpms-text-primary': tokens.textPrimary,
    '--mpms-text-secondary': tokens.textSecondary,
    '--mpms-text-tertiary': tokens.textTertiary,
    '--mpms-text-disabled': tokens.textDisabled,

    '--mpms-border-color': tokens.borderColor,
    '--mpms-border-light': tokens.borderLight,

    '--mpms-success': tokens.success,
    '--mpms-warning': tokens.warning,
    '--mpms-error': tokens.error,
    '--mpms-info': tokens.info,

    '--mpms-hover-bg': tokens.hoverBg,
    '--mpms-active-bg': tokens.activeBg,

    '--mpms-danger': tokens.danger,
    '--mpms-danger-hover': tokens.dangerHover,
    '--mpms-danger-bg': tokens.dangerBg,
  };
}
