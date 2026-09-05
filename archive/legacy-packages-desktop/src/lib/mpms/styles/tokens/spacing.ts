/**
 * Spacing Design Tokens
 * 间距设计令牌
 */

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;

  // Component-specific spacing
  sidebarWidth: string;
  sidebarCollapsedWidth: string;
  headerHeight: string;
  tabbarHeight: string;
  rightSidebarWidth: string;

  // Padding
  paddingXs: string;
  paddingSm: string;
  paddingMd: string;
  paddingLg: string;

  // Gap
  gapXs: string;
  gapSm: string;
  gapMd: string;
  gapLg: string;
}

export const defaultSpacing: SpacingTokens = {
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
};

/**
 * Generate CSS spacing variables from spacing tokens
 * 从间距令牌生成CSS间距变量
 */
export function generateSpacingCSSVariables(tokens: SpacingTokens): Record<string, string> {
  return {
    '--mpms-space-xs': tokens.xs,
    '--mpms-space-sm': tokens.sm,
    '--mpms-space-md': tokens.md,
    '--mpms-space-lg': tokens.lg,
    '--mpms-space-xl': tokens.xl,
    '--mpms-space-xxl': tokens.xxl,

    '--mpms-sidebar-width': tokens.sidebarWidth,
    '--mpms-sidebar-collapsed-width': tokens.sidebarCollapsedWidth,
    '--mpms-header-height': tokens.headerHeight,
    '--mpms-tabbar-height': tokens.tabbarHeight,
    '--mpms-right-sidebar-width': tokens.rightSidebarWidth,

    '--mpms-padding-xs': tokens.paddingXs,
    '--mpms-padding-sm': tokens.paddingSm,
    '--mpms-padding-md': tokens.paddingMd,
    '--mpms-padding-lg': tokens.paddingLg,

    '--mpms-gap-xs': tokens.gapXs,
    '--mpms-gap-sm': tokens.gapSm,
    '--mpms-gap-md': tokens.gapMd,
    '--mpms-gap-lg': tokens.gapLg,
  };
}
