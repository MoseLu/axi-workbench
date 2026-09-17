/**
 * Size Design Tokens
 * 尺寸设计令牌
 */

export interface SizeTokens {
  // Icon sizes
  iconXs: number;
  iconSm: number;
  iconMd: number;
  iconLg: number;
  iconXl: number;

  // Button heights
  buttonHeightSm: number;
  buttonHeightMd: number;
  buttonHeightLg: number;

  // Border radius
  radiusXs: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusFull: string;

  // Border width
  borderWidthSm: number;
  borderWidthMd: number;
  borderWidthLg: number;

  // Z-index scale
  zIndexDropdown: number;
  zIndexSticky: number;
  zIndexFixed: number;
  zIndexModalBackdrop: number;
  zIndexModal: number;
  zIndexPopover: number;
  zIndexTooltip: number;
}

export const defaultSizes: SizeTokens = {
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
};

/**
 * Generate CSS size variables from size tokens
 * 从尺寸令牌生成CSS尺寸变量
 */
export function generateSizeCSSVariables(tokens: SizeTokens): Record<string, string> {
  return {
    '--mpms-size-icon-xs': `${tokens.iconXs}px`,
    '--mpms-size-icon-sm': `${tokens.iconSm}px`,
    '--mpms-size-icon-md': `${tokens.iconMd}px`,
    '--mpms-size-icon-lg': `${tokens.iconLg}px`,
    '--mpms-size-icon-xl': `${tokens.iconXl}px`,

    '--mpms-size-button-height-sm': `${tokens.buttonHeightSm}px`,
    '--mpms-size-button-height-md': `${tokens.buttonHeightMd}px`,
    '--mpms-size-button-height-lg': `${tokens.buttonHeightLg}px`,

    '--mpms-radius-xs': tokens.radiusXs,
    '--mpms-radius-sm': tokens.radiusSm,
    '--mpms-radius-md': tokens.radiusMd,
    '--mpms-radius-lg': tokens.radiusLg,
    '--mpms-radius-full': tokens.radiusFull,

    '--mpms-border-width-sm': `${tokens.borderWidthSm}px`,
    '--mpms-border-width-md': `${tokens.borderWidthMd}px`,
    '--mpms-border-width-lg': `${tokens.borderWidthLg}px`,

    '--mpms-z-index-dropdown': String(tokens.zIndexDropdown),
    '--mpms-z-index-sticky': String(tokens.zIndexSticky),
    '--mpms-z-index-fixed': String(tokens.zIndexFixed),
    '--mpms-z-index-modal-backdrop': String(tokens.zIndexModalBackdrop),
    '--mpms-z-index-modal': String(tokens.zIndexModal),
    '--mpms-z-index-popover': String(tokens.zIndexPopover),
    '--mpms-z-index-tooltip': String(tokens.zIndexTooltip),
  };
}
