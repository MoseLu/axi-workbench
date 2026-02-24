// ============================================
// Theme Types
// ============================================

export interface ColorToken {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  success: string
  warning: string
  error: string
  info: string
}

export interface SpaceToken {
  xs: string
  sm: string
  md: string
  lg: string
  xl: string
  xxl: string
}

export interface TypographyToken {
  fontFamily: string
  fontSize: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    xxl: string
  }
  fontWeight: {
    normal: number
    medium: number
    bold: number
  }
  lineHeight: {
    tight: number
    normal: number
    relaxed: number
  }
}

export interface Theme {
  colors: ColorToken
  space: SpaceToken
  typography: TypographyToken
  radius: string
  shadows: string[]
}

export type ThemeMode = "light" | "dark"
