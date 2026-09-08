/**
 * Typography Design Tokens
 * 排版设计令牌
 */

export interface TypographyTokens {
  // Font families
  fontFamily: string;
  fontFamilyMono: string;

  // Font sizes
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontSizeXxl: string;

  // Font weights
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightSemibold: number;
  fontWeightBold: number;

  // Line heights
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightRelaxed: number;

  // Letter spacing
  letterSpacingTight: string;
  letterSpacingNormal: string;
  letterSpacingWide: string;
}

export const defaultTypography: TypographyTokens = {
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
};

/**
 * Generate CSS typography variables from typography tokens
 * 从排版令牌生成CSS排版变量
 */
export function generateTypographyCSSVariables(tokens: TypographyTokens): Record<string, string> {
  return {
    '--mpms-font-family': tokens.fontFamily,
    '--mpms-font-family-mono': tokens.fontFamilyMono,

    '--mpms-font-size-xs': tokens.fontSizeXs,
    '--mpms-font-size-sm': tokens.fontSizeSm,
    '--mpms-font-size-md': tokens.fontSizeMd,
    '--mpms-font-size-lg': tokens.fontSizeLg,
    '--mpms-font-size-xl': tokens.fontSizeXl,
    '--mpms-font-size-xxl': tokens.fontSizeXxl,

    '--mpms-font-weight-normal': String(tokens.fontWeightNormal),
    '--mpms-font-weight-medium': String(tokens.fontWeightMedium),
    '--mpms-font-weight-semibold': String(tokens.fontWeightSemibold),
    '--mpms-font-weight-bold': String(tokens.fontWeightBold),

    '--mpms-line-height-tight': String(tokens.lineHeightTight),
    '--mpms-line-height-normal': String(tokens.lineHeightNormal),
    '--mpms-line-height-relaxed': String(tokens.lineHeightRelaxed),

    '--mpms-letter-spacing-tight': tokens.letterSpacingTight,
    '--mpms-letter-spacing-normal': tokens.letterSpacingNormal,
    '--mpms-letter-spacing-wide': tokens.letterSpacingWide,
  };
}
