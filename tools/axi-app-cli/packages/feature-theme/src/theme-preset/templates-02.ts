import type { ThemePresetContribution } from '@axi/scaffold-kit';
import {
  createThemeModeDarkBackgroundTokens,
  createThemeModeDarkBorderTokens,
  createThemeModeDarkShadowTokens,
  createThemeModeDarkTextTokens,
  createThemeModeLightBackgroundTokens,
  createThemeModeLightBorderTokens,
  createThemeModeLightShadowTokens,
  createThemeModeLightTextTokens,
} from '../theme-token-fragments.js';

export function createPresetCssBlock(themePreset: ThemePresetContribution): string {
  return `[data-theme-preset='${themePreset.id}'] {
  --color-accent-primary: var(--theme-preset-${themePreset.id}-color-accent-primary);
  --color-accent-secondary: var(--theme-preset-${themePreset.id}-color-accent-secondary);
  --theme-preset-surface-tint: var(--theme-preset-${themePreset.id}-color-surface-tint);
  --theme-preset-surface-panel-base-weight: var(--theme-preset-${themePreset.id}-effect-surface-panel-base-weight);
  --theme-preset-surface-spotlight-base-weight: var(--theme-preset-${themePreset.id}-effect-surface-spotlight-base-weight);
  --theme-preset-surface-tag-base-weight: var(--theme-preset-${themePreset.id}-effect-surface-tag-base-weight);
  --effect-surface-backdrop: var(--theme-preset-${themePreset.id}-effect-surface-backdrop);
  --font-family-display: var(--theme-preset-${themePreset.id}-font-family-display);
  --font-family-sans: var(--theme-preset-${themePreset.id}-font-family-sans);
  --radius-lg: var(--theme-preset-${themePreset.id}-radius-lg);
  --radius-md: var(--theme-preset-${themePreset.id}-radius-md);
  --radius-sm: var(--theme-preset-${themePreset.id}-radius-sm);
  --shadow-button: var(--theme-preset-${themePreset.id}-shadow-button);
  --shadow-button-hover: var(--theme-preset-${themePreset.id}-shadow-button-hover);
  --shadow-card: var(--theme-preset-${themePreset.id}-shadow-card);
  --shadow-card-hover: var(--theme-preset-${themePreset.id}-shadow-card-hover);
}`;
}

export function createThemeCss(themePresets: ThemePresetContribution[]): string {
  const defaultThemePreset = themePresets[0]?.id ?? 'minimal';
  const presetBlocks = themePresets.map((themePreset) => createPresetCssBlock(themePreset)).join('\n\n');

  return `:root {
  color-scheme: light;
  --color-accent-primary: var(--theme-preset-${defaultThemePreset}-color-accent-primary);
  --color-accent-secondary: var(--theme-preset-${defaultThemePreset}-color-accent-secondary);
  --color-bg-active: var(--theme-mode-light-color-bg-active);
  --color-bg-disabled: var(--theme-mode-light-color-bg-disabled);
  --color-bg-elevated: var(--theme-mode-light-color-bg-elevated);
  --color-bg-hover: var(--theme-mode-light-color-bg-hover);
  --color-bg-overlay: var(--theme-mode-light-color-bg-overlay);
  --color-bg-page: var(--theme-mode-light-color-bg-page);
  --color-bg-surface: var(--theme-mode-light-color-bg-surface);
  --color-border-default: var(--theme-mode-light-color-border-default);
  --color-border-focus: var(--theme-mode-light-color-border-focus);
  --color-border-light: var(--theme-mode-light-color-border-light);
  --color-border-main: var(--theme-mode-light-color-border-main);
  --color-border-strong: var(--theme-mode-light-color-border-strong);
  --color-border-subtle: var(--theme-mode-light-color-border-subtle);
  --color-border-dark: var(--theme-mode-light-color-border-dark);
  --color-focus-ring: var(--theme-mode-light-color-focus-ring);
  --color-surface-backdrop: var(--theme-mode-light-color-surface-backdrop);
  --color-surface-elevated: var(--theme-mode-light-color-surface-elevated);
  --color-surface-input: var(--theme-mode-light-color-surface-input);
  --color-surface-page: var(--theme-mode-light-color-surface-page);
  --color-text-disabled: var(--theme-mode-light-color-text-disabled);
  --color-text-inverse: var(--theme-mode-light-color-text-inverse);
  --color-text-muted: var(--theme-mode-light-color-text-muted);
  --color-text-primary: var(--theme-mode-light-color-text-primary);
  --color-text-secondary: var(--theme-mode-light-color-text-secondary);
  --color-text-tertiary: var(--theme-mode-light-color-text-tertiary);
  --theme-mode-surface-panel-base: var(--theme-mode-light-color-surface-panel-base);
  --theme-mode-surface-spotlight-base: var(--theme-mode-light-color-surface-spotlight-base);
  --theme-mode-surface-tag-base: var(--theme-mode-light-color-surface-tag-base);
  --theme-preset-surface-tint: var(--theme-preset-${defaultThemePreset}-color-surface-tint);
  --theme-preset-surface-panel-base-weight: var(--theme-preset-${defaultThemePreset}-effect-surface-panel-base-weight);
  --theme-preset-surface-spotlight-base-weight: var(--theme-preset-${defaultThemePreset}-effect-surface-spotlight-base-weight);
  --theme-preset-surface-tag-base-weight: var(--theme-preset-${defaultThemePreset}-effect-surface-tag-base-weight);
  --color-surface-panel: color-mix(
    in srgb,
    var(--theme-mode-surface-panel-base) var(--theme-preset-surface-panel-base-weight),
    var(--theme-preset-surface-tint)
  );
  --color-surface-spotlight: color-mix(
    in srgb,
    var(--theme-mode-surface-spotlight-base) var(--theme-preset-surface-spotlight-base-weight),
    var(--theme-preset-surface-tint)
  );
  --color-surface-tag: color-mix(
    in srgb,
    var(--theme-mode-surface-tag-base) var(--theme-preset-surface-tag-base-weight),
    var(--theme-preset-surface-tint)
  );
  --effect-surface-backdrop: var(--theme-preset-${defaultThemePreset}-effect-surface-backdrop);
  --font-family-display: var(--theme-preset-${defaultThemePreset}-font-family-display);
  --font-family-sans: var(--theme-preset-${defaultThemePreset}-font-family-sans);
  --radius-lg: var(--theme-preset-${defaultThemePreset}-radius-lg);
  --radius-md: var(--theme-preset-${defaultThemePreset}-radius-md);
  --radius-sm: var(--theme-preset-${defaultThemePreset}-radius-sm);
  --shadow-button: var(--theme-preset-${defaultThemePreset}-shadow-button);
  --shadow-button-hover: var(--theme-preset-${defaultThemePreset}-shadow-button-hover);
  --shadow-card: var(--theme-preset-${defaultThemePreset}-shadow-card);
  --shadow-card-hover: var(--theme-preset-${defaultThemePreset}-shadow-card-hover);
  --shadow-field: var(--theme-mode-light-shadow-field);
  --theme-name: light;
  --theme-color-scheme: light;
  --theme-bg-page: var(--color-bg-page);
  --theme-bg-surface: var(--color-bg-surface);
  --theme-bg-elevated: var(--color-bg-elevated);
  --theme-bg-overlay: var(--color-bg-overlay);
  --theme-bg-hover: var(--color-bg-hover);
  --theme-bg-active: var(--color-bg-active);
  --theme-bg-disabled: var(--color-bg-disabled);
  --theme-text-primary: var(--color-text-primary);
  --theme-text-secondary: var(--color-text-secondary);
  --theme-text-tertiary: var(--color-text-tertiary);
  --theme-text-disabled: var(--color-text-disabled);
  --theme-text-inverse: var(--color-text-inverse);
  --theme-border-light: var(--color-border-light);
  --theme-border-main: var(--color-border-main);
  --theme-border-dark: var(--color-border-dark);
  --theme-border-focus: var(--color-border-focus);
  --theme-card-bg: var(--color-surface-elevated);
  --theme-card-border: var(--color-border-light);
  --theme-glass-bg: var(--color-surface-panel);
  --theme-glass-border: var(--color-border-subtle);
  --theme-shadow-sm: var(--theme-mode-light-shadow-sm);
  --theme-shadow-md: var(--theme-mode-light-shadow-md);
  --theme-shadow-lg: var(--theme-mode-light-shadow-lg);
  --theme-shadow-xl: var(--theme-mode-light-shadow-xl);
  --theme-button-primary-bg: var(--color-accent-primary);
  --theme-button-primary-text: var(--color-text-inverse);
  --theme-button-hover-bg: var(--color-accent-secondary);
  --theme-button-active-bg: var(--color-accent-primary);
  --theme-link-color: var(--color-accent-primary);
  --theme-link-hover-color: var(--color-accent-secondary);
  --bg-color-base: var(--theme-bg-page);
  --bg-color-surface: var(--theme-bg-surface);
  --bg-color-elevated: var(--theme-bg-elevated);
  --text-color-primary: var(--theme-text-primary);
  --text-color-secondary: var(--theme-text-secondary);
  --text-color-tertiary: var(--theme-text-tertiary);
  --border-color: var(--theme-border-main);
  --border-color-light: var(--theme-border-light);
}

[data-theme-mode='dark'] {
  --color-bg-active: var(--theme-mode-dark-color-bg-active);
  --color-bg-disabled: var(--theme-mode-dark-color-bg-disabled);
  --color-bg-elevated: var(--theme-mode-dark-color-bg-elevated);
  --color-bg-hover: var(--theme-mode-dark-color-bg-hover);
  --color-bg-overlay: var(--theme-mode-dark-color-bg-overlay);
  --color-bg-page: var(--theme-mode-dark-color-bg-page);
  --color-bg-surface: var(--theme-mode-dark-color-bg-surface);
  --color-border-default: var(--theme-mode-dark-color-border-default);
  --color-border-focus: var(--theme-mode-dark-color-border-focus);
  --color-border-light: var(--theme-mode-dark-color-border-light);
  --color-border-main: var(--theme-mode-dark-color-border-main);
  --color-border-strong: var(--theme-mode-dark-color-border-strong);
  --color-border-subtle: var(--theme-mode-dark-color-border-subtle);
  --color-border-dark: var(--theme-mode-dark-color-border-dark);
  --color-focus-ring: var(--theme-mode-dark-color-focus-ring);
  --color-surface-backdrop: var(--theme-mode-dark-color-surface-backdrop);
  --color-surface-elevated: var(--theme-mode-dark-color-surface-elevated);
  --color-surface-input: var(--theme-mode-dark-color-surface-input);
  --color-surface-page: var(--theme-mode-dark-color-surface-page);
  --color-text-disabled: var(--theme-mode-dark-color-text-disabled);
  --color-text-inverse: var(--theme-mode-dark-color-text-inverse);
  --color-text-muted: var(--theme-mode-dark-color-text-muted);
  --color-text-primary: var(--theme-mode-dark-color-text-primary);
  --color-text-secondary: var(--theme-mode-dark-color-text-secondary);
  --color-text-tertiary: var(--theme-mode-dark-color-text-tertiary);
  --theme-mode-surface-panel-base: var(--theme-mode-dark-color-surface-panel-base);
  --theme-mode-surface-spotlight-base: var(--theme-mode-dark-color-surface-spotlight-base);
  --theme-mode-surface-tag-base: var(--theme-mode-dark-color-surface-tag-base);
  --shadow-field: var(--theme-mode-dark-shadow-field);
  --theme-name: dark;
  --theme-color-scheme: dark;
  --theme-shadow-sm: var(--theme-mode-dark-shadow-sm);
  --theme-shadow-md: var(--theme-mode-dark-shadow-md);
  --theme-shadow-lg: var(--theme-mode-dark-shadow-lg);
  --theme-shadow-xl: var(--theme-mode-dark-shadow-xl);
}

${presetBlocks}
`;
}

export function createThemePresetDoc(themePresets: ThemePresetContribution[]): string {
  const presetList = themePresets.map((themePreset) => `- \`${themePreset.id}\`: ${themePreset.description}`).join('\n');

  return `# Theme Preset

This module is the runtime composition layer for all installed theme style features.

## Layers

1. \`packages/tokens/tokens/foundation/*\` owns the stable global token vocabulary.
2. \`packages/tokens/tokens/theme/modes/*\` owns light and dark semantic overrides by domain.
3. \`packages/tokens/tokens/theme/presets/*\` owns visual style presets as separate feature modules.
4. \`apps/web/src/shared/theme/theme.css\` maps the active mode and preset to runtime semantic CSS variables.
5. \`apps/web/src/shared/theme/registry.ts\`, \`useThemePreferences.ts\`, and \`useTheme.ts\` own runtime metadata and compatibility hooks.
6. \`apps/web/src/shared/theme/ThemeSwitcher.tsx\` provides a reusable control surface for mode and preset selection.

## Composition Model

- modes and presets are orthogonal dimensions
- the relationship is cartesian: every mode should work with every installed preset
- mode tokens control luminance and semantic contrast
- preset tokens control accent, material tint, geometry, typography, and atmosphere
- do not let the same semantic slot be overridden by both dimensions

## Installed Presets

${presetList || '- none'}

## Add A New Preset

1. Create a new \`theme-style-<name>\` feature module.
2. Add its token files under \`packages/tokens/tokens/theme/presets/<name>/\`.
3. Register its metadata through a \`contributions\` entry with type \`theme-preset\`.
4. Keep the preset orthogonal: update only preset-owned slots unless you are intentionally changing the composition contract.
`;
}
