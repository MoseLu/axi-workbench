import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

function createUiFoundationPackageJson(packageSlug: string): string {
  return `${JSON.stringify(
    {
      name: `@${packageSlug}/ui-foundation`,
      private: true,
      version: '0.1.0',
      type: 'module',
      exports: {
        '.': './src/index.ts',
      },
    },
    null,
    2,
  )}\n`;
}

function createUiFoundationIndex(): string {
  return `export * from './tokens';
export * from './layout';
export * from './interaction';
export * from './typography';
export * from './themes';
`;
}

function createUiFoundationTokens(): string {
  return `export const colorScale = {
  danger: 'var(--color-danger-main)',
  info: 'var(--color-info-main)',
  neutral900: 'var(--color-neutral-900)',
  primary: 'var(--color-primary-main)',
  success: 'var(--color-success-main)',
  warning: 'var(--color-warning-main)',
} as const;

export const semanticTextColors = {
  disabled: 'var(--theme-text-disabled)',
  inverse: 'var(--theme-text-inverse)',
  primary: 'var(--theme-text-primary)',
  secondary: 'var(--theme-text-secondary)',
  tertiary: 'var(--theme-text-tertiary)',
} as const;

export const semanticSurfaceColors = {
  active: 'var(--theme-bg-active)',
  elevated: 'var(--theme-bg-elevated)',
  hover: 'var(--theme-bg-hover)',
  page: 'var(--theme-bg-page)',
  panel: 'var(--color-surface-panel)',
  surface: 'var(--theme-bg-surface)',
} as const;

export const semanticBorderColors = {
  focus: 'var(--theme-border-focus)',
  light: 'var(--theme-border-light)',
  main: 'var(--theme-border-main)',
  strong: 'var(--color-border-strong)',
} as const;

export const spacingScale = {
  0: '0',
  1: '0.25rem',
  10: '2.5rem',
  12: '3rem',
  2: '0.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '2rem',
  8: '2.5rem',
  9: '2.25rem',
} as const;

export const radiusScale = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
} as const;

export const shadowScale = {
  button: 'var(--shadow-button)',
  buttonHover: 'var(--shadow-button-hover)',
  card: 'var(--shadow-card)',
  cardHover: 'var(--shadow-card-hover)',
  field: 'var(--shadow-field)',
} as const;

export const borderScale = {
  default: 'var(--border-width-default)',
  focus: 'var(--border-width-focus)',
} as const;

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndices = {
  dropdown: 'var(--z-dropdown)',
  fixed: 'var(--z-fixed)',
  modal: 'var(--z-modal)',
  notification: 'var(--z-notification)',
  popover: 'var(--z-popover)',
  sticky: 'var(--z-sticky)',
  tooltip: 'var(--z-tooltip)',
} as const;
`;
}

function createUiFoundationLayout(): string {
  return `export const containerScale = {
  page: 'var(--layout-container-page-max)',
  reading: 'var(--layout-measure-reading)',
} as const;

export const sectionSpacing = {
  hero: 'var(--layout-section-space-hero)',
  page: 'var(--layout-section-space-page)',
} as const;

export const semanticSpacing = {
  cardPadding: 'var(--card-padding-x)',
  pagePadding: 'var(--page-padding-x)',
  topbarHeight: 'var(--topbar-height)',
  topbarItemGap: 'var(--topbar-item-gap)',
} as const;

export const gridPatterns = {
  cards: 'repeat(auto-fit, minmax(var(--layout-grid-card-min), 1fr))',
} as const;
`;
}

function createUiFoundationInteraction(): string {
  return `export const motionTokens = {
  emphasized: 'var(--motion-easing-emphasized)',
  fast: 'var(--motion-duration-fast)',
  slow: 'var(--motion-duration-slow)',
  standard: 'var(--motion-easing-standard)',
} as const;

export const interactiveSurfaceTokens = {
  backdrop: 'var(--effect-surface-backdrop)',
  focusRing: 'var(--color-focus-ring)',
} as const;

export const interactionTokens = {
  activeScale: 'var(--interaction-active-scale)',
  activeTranslateY: 'var(--interaction-active-translate-y)',
  disabledOpacity: 'var(--interaction-disabled-opacity)',
  hoverCardLift: 'var(--interaction-hover-card-lift)',
  hoverLift: 'var(--interaction-hover-lift)',
} as const;
`;
}

function createUiFoundationTypography(): string {
  return `export const typographyScale = {
  bodyLg: 'var(--font-size-body-lg)',
  bodyMd: 'var(--font-size-body-md)',
  bodySm: 'var(--font-size-body-sm)',
  displayHero: 'var(--font-size-display-hero)',
  headingSm: 'var(--font-size-heading-sm)',
} as const;

export const typeFamilies = {
  display: 'var(--font-family-display)',
  mono: 'var(--font-family-mono)',
  sans: 'var(--font-family-sans)',
} as const;
`;
}

function createUiFoundationThemes(
  themePresets: Array<{ description: string; id: string; label: string; thesis: string }>,
): string {
  const presetEntries = themePresets
    .map(
      (themePreset) => `  {
    id: '${themePreset.id}',
    label: '${themePreset.label}',
    description: '${themePreset.description}',
    thesis: '${themePreset.thesis}',
  },`,
    )
    .join('\n');

  return `export interface ThemeModeDefinition {
  description: string;
  id: 'light' | 'dark';
  label: string;
}

export interface ThemePresetDefinition {
  description: string;
  id: string;
  label: string;
  thesis: string;
}

export const themeCompositionModel = 'cartesian' as const;

export const themeModeOwnedSlots = [
  'color.border.*',
  'color.focus.ring',
  'color.surface.backdrop',
  'color.surface.elevated',
  'color.surface.input',
  'color.surface.page',
  'color.surface.*Base',
  'color.text.*',
  'shadow.field',
] as const;

export const themePresetOwnedSlots = [
  'color.accent.*',
  'color.surface.tint',
  'effect.surface.backdrop',
  'effect.surface.*BaseWeight',
  'font.family.display',
  'font.family.sans',
  'radius.*',
  'shadow.button*',
  'shadow.card*',
] as const;

export const themeSlots = {
  accentPrimary: 'var(--color-accent-primary)',
  accentSecondary: 'var(--color-accent-secondary)',
  buttonPrimaryBg: 'var(--theme-button-primary-bg)',
  borderDefault: 'var(--color-border-default)',
  surfaceActive: 'var(--theme-bg-active)',
  surfaceBackdrop: 'var(--color-surface-backdrop)',
  surfacePage: 'var(--color-surface-page)',
  surfacePanel: 'var(--color-surface-panel)',
  surfaceSpotlight: 'var(--color-surface-spotlight)',
  textMuted: 'var(--color-text-muted)',
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
} as const;

export const themeModeCatalog: ThemeModeDefinition[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Bright surfaces with restrained contrast for product and editorial layouts.',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Low-luminance surfaces with strong focus contrast for immersive workflows.',
  },
];

export const themePresetCatalog: ThemePresetDefinition[] = [
${presetEntries}
];
`;
}

function createStyleSystemDoc(): string {
  return `# Style System

This extension module adds \`packages/ui-foundation\` as the typed contract for the visual system.

It centralizes:

- semantic colors
- spacing
- breakpoints
- z-index
- radius
- shadows
- border widths
- typography
- motion
- interaction states
- layout
- theme slots
- orthogonal theme ownership by dimension

Keep reusable styling contracts here before they become framework-specific components or utilities.
`;
}

export const styleSystemManifest = {
  category: 'styling',
  configKey: 'modules.style-system.enabled',
  dependencies: ['theme-preset'],
  description: 'Typed style-system contract for spacing, motion, layout, typography, and theme slots.',
  enabledByDefault: true,
  id: 'style-system',
  layer: 'extension',
  title: 'Style System',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyStyleSystem(context: FeatureRenderContext): ProjectFile[] {
  return [
      {
        path: 'packages/ui-foundation/package.json',
        content: createUiFoundationPackageJson(context.packageSlug),
      },
      { path: 'packages/ui-foundation/src/index.ts', content: createUiFoundationIndex() },
      { path: 'packages/ui-foundation/src/tokens.ts', content: createUiFoundationTokens() },
      { path: 'packages/ui-foundation/src/layout.ts', content: createUiFoundationLayout() },
      {
        path: 'packages/ui-foundation/src/interaction.ts',
        content: createUiFoundationInteraction(),
      },
      {
        path: 'packages/ui-foundation/src/typography.ts',
        content: createUiFoundationTypography(),
      },
      {
        path: 'packages/ui-foundation/src/themes.ts',
        content: createUiFoundationThemes(context.selectedThemePresetContributions),
      },
      { path: 'packages/ui-foundation/README.md', content: createStyleSystemDoc() },
  ];
}

export const styleSystemFeature = defineScaffoldFeature(styleSystemManifest, applyStyleSystem);
