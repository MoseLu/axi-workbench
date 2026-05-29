import { serializeJson } from '@axi/scaffold-kit';

function createThemeModeTokens(modeId: 'light' | 'dark', value: Record<string, unknown>): string {
  return serializeJson({
    themeMode: {
      [modeId]: value,
    },
  });
}

export function createThemeModeLightBackgroundTokens(): string {
  return createThemeModeTokens('light', {
    color: {
      bg: {
        active: { value: '#e5e5e5' },
        disabled: { value: '#f5f5f5' },
        elevated: { value: '#fafafa' },
        hover: { value: '#f5f5f5' },
        overlay: { value: 'rgba(0, 0, 0, 0.5)' },
        page: { value: '#fafafa' },
        surface: { value: '#fafafa' },
      },
      surface: {
        backdrop: { value: '#fafafa' },
        elevated: { value: '#fafafa' },
        input: { value: '#ffffff' },
        page: { value: '#fafafa' },
        surface: { value: '#fafafa' },
        panelBase: { value: 'rgba(255, 255, 255, 0.92)' },
        spotlightBase: { value: 'rgba(255, 255, 255, 0.84)' },
        tagBase: { value: 'rgba(255, 255, 255, 0.9)' },
      },
    },
  });
}

export function createThemeModeLightBorderTokens(): string {
  return createThemeModeTokens('light', {
    color: {
      border: {
        dark: { value: '#a3a3a3' },
        default: { value: '#d4d4d4' },
        focus: { value: '#0ea5e9' },
        light: { value: '#e5e5e5' },
        main: { value: '#d4d4d4' },
        strong: { value: '#a3a3a3' },
        subtle: { value: '#e5e5e5' },
      },
      focus: {
        ring: { value: 'rgba(14, 165, 233, 0.18)' },
      },
    },
  });
}

export function createThemeModeLightTextTokens(): string {
  return createThemeModeTokens('light', {
    color: {
      text: {
        disabled: { value: '#a3a3a3' },
        inverse: { value: '#fafafa' },
        muted: { value: '#737373' },
        primary: { value: '#171717' },
        secondary: { value: '#525252' },
        tertiary: { value: '#737373' },
      },
    },
  });
}

export function createThemeModeLightShadowTokens(): string {
  return createThemeModeTokens('light', {
    shadow: {
      lg: { value: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' },
      md: { value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' },
      sm: { value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
      xl: { value: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' },
      field: { value: '0 8px 24px rgba(31, 31, 26, 0.04)' },
    },
  });
}

export function createThemeModeDarkBackgroundTokens(): string {
  return createThemeModeTokens('dark', {
    color: {
      bg: {
        active: { value: '#334155' },
        disabled: { value: '#1e293b' },
        elevated: { value: '#1e293b' },
        hover: { value: '#1e293b' },
        overlay: { value: 'rgba(0, 0, 0, 0.7)' },
        page: { value: '#020617' },
        surface: { value: '#0f172a' },
      },
      surface: {
        backdrop: { value: '#020617' },
        elevated: { value: '#1e293b' },
        input: { value: 'rgba(30, 41, 59, 0.9)' },
        page: { value: '#020617' },
        surface: { value: '#0f172a' },
        panelBase: { value: 'rgba(15, 23, 42, 0.92)' },
        spotlightBase: { value: 'rgba(15, 23, 42, 0.84)' },
        tagBase: { value: 'rgba(30, 41, 59, 0.9)' },
      },
    },
  });
}

export function createThemeModeDarkBorderTokens(): string {
  return createThemeModeTokens('dark', {
    color: {
      border: {
        dark: { value: '#64748b' },
        default: { value: '#475569' },
        focus: { value: '#0ea5e9' },
        light: { value: '#334155' },
        main: { value: '#475569' },
        strong: { value: '#64748b' },
        subtle: { value: '#334155' },
      },
      focus: {
        ring: { value: 'rgba(14, 165, 233, 0.24)' },
      },
    },
  });
}

export function createThemeModeDarkTextTokens(): string {
  return createThemeModeTokens('dark', {
    color: {
      text: {
        disabled: { value: '#475569' },
        inverse: { value: '#0f172a' },
        muted: { value: '#64748b' },
        primary: { value: '#f1f5f9' },
        secondary: { value: '#94a3b8' },
        tertiary: { value: '#64748b' },
      },
    },
  });
}

export function createThemeModeDarkShadowTokens(): string {
  return createThemeModeTokens('dark', {
    shadow: {
      lg: { value: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)' },
      md: { value: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' },
      sm: { value: '0 1px 2px 0 rgba(0, 0, 0, 0.3)' },
      xl: { value: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)' },
      field: { value: '0 12px 28px rgba(0, 0, 0, 0.24)' },
    },
  });
}

function createThemePresetTokens(presetId: string, value: Record<string, unknown>): string {
  return serializeJson({
    themePreset: {
      [presetId]: value,
    },
  });
}

function createThemePresetAccentTokens(
  presetId: string,
  primary: string,
  secondary: string,
): string {
  return createThemePresetTokens(presetId, {
    color: {
      accent: {
        primary: { value: primary },
        secondary: { value: secondary },
      },
    },
  });
}

function createThemePresetSurfaceTokens(
  presetId: string,
  tint: string,
  backdrop: string,
  panelBaseWeight: string,
  spotlightBaseWeight: string,
  tagBaseWeight: string,
): string {
  return createThemePresetTokens(presetId, {
    color: {
      surface: {
        tint: { value: tint },
      },
    },
    effect: {
      surface: {
        backdrop: { value: backdrop },
        panelBaseWeight: { value: panelBaseWeight },
        spotlightBaseWeight: { value: spotlightBaseWeight },
        tagBaseWeight: { value: tagBaseWeight },
      },
    },
  });
}

function createThemePresetTypographyTokens(
  presetId: string,
  display: string,
  sans: string,
): string {
  return createThemePresetTokens(presetId, {
    font: {
      family: {
        display: { value: display },
        sans: { value: sans },
      },
    },
  });
}

function createThemePresetRadiusTokens(
  presetId: string,
  lg: string,
  md: string,
  sm: string,
): string {
  return createThemePresetTokens(presetId, {
    radius: {
      lg: { value: lg },
      md: { value: md },
      sm: { value: sm },
    },
  });
}

function createThemePresetShadowTokens(
  presetId: string,
  button: string,
  buttonHover: string,
  card: string,
  cardHover: string,
): string {
  return createThemePresetTokens(presetId, {
    shadow: {
      button: { value: button },
      buttonHover: { value: buttonHover },
      card: { value: card },
      cardHover: { value: cardHover },
    },
  });
}

export function createThemePresetMinimalAccentTokens(): string {
  return createThemePresetAccentTokens('minimal', '#111827', '#4b5563');
}

export function createThemePresetMinimalSurfaceTokens(): string {
  return createThemePresetSurfaceTokens('minimal', '#111827', 'blur(0px)', '96%', '90%', '88%');
}

export function createThemePresetMinimalTypographyTokens(): string {
  return createThemePresetTypographyTokens(
    'minimal',
    "'IBM Plex Sans', 'Segoe UI', sans-serif",
    "'IBM Plex Sans', 'Segoe UI', 'PingFang SC', sans-serif",
  );
}

export function createThemePresetMinimalRadiusTokens(): string {
  return createThemePresetRadiusTokens('minimal', '20px', '12px', '10px');
}

export function createThemePresetMinimalShadowTokens(): string {
  return createThemePresetShadowTokens(
    'minimal',
    '0 10px 24px rgba(17, 24, 39, 0.1)',
    '0 14px 32px rgba(17, 24, 39, 0.14)',
    '0 12px 28px rgba(17, 24, 39, 0.06)',
    '0 16px 36px rgba(17, 24, 39, 0.1)',
  );
}

export function createThemePresetCyberpunkAccentTokens(): string {
  return createThemePresetAccentTokens('cyberpunk', '#6f3cff', '#1ee6ff');
}

export function createThemePresetCyberpunkSurfaceTokens(): string {
  return createThemePresetSurfaceTokens('cyberpunk', '#6f3cff', 'blur(12px)', '82%', '70%', '78%');
}

export function createThemePresetCyberpunkTypographyTokens(): string {
  return createThemePresetTypographyTokens(
    'cyberpunk',
    "'Sora', 'Space Grotesk', 'Segoe UI', sans-serif",
    "'Sora', 'IBM Plex Sans', 'Segoe UI', 'PingFang SC', sans-serif",
  );
}

export function createThemePresetCyberpunkRadiusTokens(): string {
  return createThemePresetRadiusTokens('cyberpunk', '18px', '12px', '8px');
}

export function createThemePresetCyberpunkShadowTokens(): string {
  return createThemePresetShadowTokens(
    'cyberpunk',
    '0 0 0 1px rgba(111, 60, 255, 0.3), 0 18px 38px rgba(63, 30, 150, 0.42)',
    '0 0 0 1px rgba(111, 60, 255, 0.45), 0 22px 44px rgba(63, 30, 150, 0.52)',
    '0 0 0 1px rgba(30, 230, 255, 0.12), 0 24px 48px rgba(0, 0, 0, 0.24)',
    '0 0 0 1px rgba(30, 230, 255, 0.22), 0 28px 56px rgba(0, 0, 0, 0.3)',
  );
}

export function createThemePresetGlassmorphismAccentTokens(): string {
  return createThemePresetAccentTokens('glassmorphism', '#3d7cff', '#65d1ff');
}

export function createThemePresetGlassmorphismSurfaceTokens(): string {
  return createThemePresetSurfaceTokens(
    'glassmorphism',
    '#c9ecff',
    'blur(26px)',
    '74%',
    '64%',
    '76%',
  );
}

export function createThemePresetGlassmorphismTypographyTokens(): string {
  return createThemePresetTypographyTokens(
    'glassmorphism',
    "'Manrope', 'Space Grotesk', 'Segoe UI', sans-serif",
    "'Manrope', 'IBM Plex Sans', 'Segoe UI', 'PingFang SC', sans-serif",
  );
}

export function createThemePresetGlassmorphismRadiusTokens(): string {
  return createThemePresetRadiusTokens('glassmorphism', '30px', '18px', '14px');
}

export function createThemePresetGlassmorphismShadowTokens(): string {
  return createThemePresetShadowTokens(
    'glassmorphism',
    '0 20px 48px rgba(61, 124, 255, 0.22)',
    '0 24px 56px rgba(61, 124, 255, 0.28)',
    '0 18px 42px rgba(61, 124, 255, 0.14)',
    '0 24px 54px rgba(61, 124, 255, 0.2)',
  );
}
