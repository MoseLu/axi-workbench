import type { ScaffoldConfig } from '@axi/scaffold-kit';
import { serializeJson } from '@axi/scaffold-kit';

interface ScssTarget {
  destination: string;
  source: string;
}

interface ScssIndexTarget {
  filePath: string;
  forwards: string[];
}

const scssTargets: ScssTarget[] = [
  { source: 'tokens/foundation/accent.json', destination: 'foundation/_accent.scss' },
  { source: 'tokens/foundation/background.json', destination: 'foundation/_background.scss' },
  { source: 'tokens/foundation/breakpoint.json', destination: 'foundation/_breakpoint.scss' },
  { source: 'tokens/foundation/border-color.json', destination: 'foundation/_border-color.scss' },
  { source: 'tokens/foundation/border.json', destination: 'foundation/_border.scss' },
  { source: 'tokens/foundation/color-scale.json', destination: 'foundation/_color-scale.scss' },
  { source: 'tokens/foundation/effect.json', destination: 'foundation/_effect.scss' },
  { source: 'tokens/foundation/interaction.json', destination: 'foundation/_interaction.scss' },
  { source: 'tokens/foundation/layout.json', destination: 'foundation/_layout.scss' },
  { source: 'tokens/foundation/motion.json', destination: 'foundation/_motion.scss' },
  { source: 'tokens/foundation/radius.json', destination: 'foundation/_radius.scss' },
  { source: 'tokens/foundation/semantic-color.json', destination: 'foundation/_semantic-color.scss' },
  { source: 'tokens/foundation/shadow.json', destination: 'foundation/_shadow.scss' },
  { source: 'tokens/foundation/space.json', destination: 'foundation/_space.scss' },
  {
    source: 'tokens/foundation/spacing-semantic.json',
    destination: 'foundation/_spacing-semantic.scss',
  },
  { source: 'tokens/foundation/text.json', destination: 'foundation/_text.scss' },
  { source: 'tokens/foundation/typography.json', destination: 'foundation/_typography.scss' },
  { source: 'tokens/foundation/z-index.json', destination: 'foundation/_z-index.scss' },
  {
    source: 'tokens/theme/modes/light/background.json',
    destination: 'theme/modes/light/_background.scss',
  },
  {
    source: 'tokens/theme/modes/light/border.json',
    destination: 'theme/modes/light/_border.scss',
  },
  {
    source: 'tokens/theme/modes/light/shadow.json',
    destination: 'theme/modes/light/_shadow.scss',
  },
  { source: 'tokens/theme/modes/light/text.json', destination: 'theme/modes/light/_text.scss' },
  {
    source: 'tokens/theme/modes/dark/background.json',
    destination: 'theme/modes/dark/_background.scss',
  },
  {
    source: 'tokens/theme/modes/dark/border.json',
    destination: 'theme/modes/dark/_border.scss',
  },
  {
    source: 'tokens/theme/modes/dark/shadow.json',
    destination: 'theme/modes/dark/_shadow.scss',
  },
  { source: 'tokens/theme/modes/dark/text.json', destination: 'theme/modes/dark/_text.scss' },
  {
    source: 'tokens/theme/presets/minimal/accent.json',
    destination: 'theme/presets/minimal/_accent.scss',
  },
  {
    source: 'tokens/theme/presets/minimal/surface.json',
    destination: 'theme/presets/minimal/_surface.scss',
  },
  {
    source: 'tokens/theme/presets/minimal/typography.json',
    destination: 'theme/presets/minimal/_typography.scss',
  },
  {
    source: 'tokens/theme/presets/minimal/radius.json',
    destination: 'theme/presets/minimal/_radius.scss',
  },
  {
    source: 'tokens/theme/presets/minimal/shadow.json',
    destination: 'theme/presets/minimal/_shadow.scss',
  },
  {
    source: 'tokens/theme/presets/cyberpunk/accent.json',
    destination: 'theme/presets/cyberpunk/_accent.scss',
  },
  {
    source: 'tokens/theme/presets/cyberpunk/surface.json',
    destination: 'theme/presets/cyberpunk/_surface.scss',
  },
  {
    source: 'tokens/theme/presets/cyberpunk/typography.json',
    destination: 'theme/presets/cyberpunk/_typography.scss',
  },
  {
    source: 'tokens/theme/presets/cyberpunk/radius.json',
    destination: 'theme/presets/cyberpunk/_radius.scss',
  },
  {
    source: 'tokens/theme/presets/cyberpunk/shadow.json',
    destination: 'theme/presets/cyberpunk/_shadow.scss',
  },
  {
    source: 'tokens/theme/presets/glassmorphism/accent.json',
    destination: 'theme/presets/glassmorphism/_accent.scss',
  },
  {
    source: 'tokens/theme/presets/glassmorphism/surface.json',
    destination: 'theme/presets/glassmorphism/_surface.scss',
  },
  {
    source: 'tokens/theme/presets/glassmorphism/typography.json',
    destination: 'theme/presets/glassmorphism/_typography.scss',
  },
  {
    source: 'tokens/theme/presets/glassmorphism/radius.json',
    destination: 'theme/presets/glassmorphism/_radius.scss',
  },
  {
    source: 'tokens/theme/presets/glassmorphism/shadow.json',
    destination: 'theme/presets/glassmorphism/_shadow.scss',
  },
];

const scssIndexTargets: ScssIndexTarget[] = [
  { filePath: 'dist/scss/_index.scss', forwards: ['./foundation', './theme'] },
  { filePath: 'dist/scss/_tokens.scss', forwards: ['./index'] },
  {
    filePath: 'dist/scss/foundation/_index.scss',
    forwards: [
      './accent',
      './background',
      './breakpoint',
      './border-color',
      './border',
      './color-scale',
      './effect',
      './interaction',
      './layout',
      './motion',
      './radius',
      './semantic-color',
      './shadow',
      './space',
      './spacing-semantic',
      './text',
      './typography',
      './z-index',
    ],
  },
  { filePath: 'dist/scss/theme/_index.scss', forwards: ['./modes', './presets'] },
  { filePath: 'dist/scss/theme/modes/_index.scss', forwards: ['./light', './dark'] },
  {
    filePath: 'dist/scss/theme/modes/light/_index.scss',
    forwards: ['./background', './border', './shadow', './text'],
  },
  {
    filePath: 'dist/scss/theme/modes/dark/_index.scss',
    forwards: ['./background', './border', './shadow', './text'],
  },
  {
    filePath: 'dist/scss/theme/presets/_index.scss',
    forwards: ['./minimal', './cyberpunk', './glassmorphism'],
  },
  {
    filePath: 'dist/scss/theme/presets/minimal/_index.scss',
    forwards: ['./accent', './surface', './typography', './radius', './shadow'],
  },
  {
    filePath: 'dist/scss/theme/presets/cyberpunk/_index.scss',
    forwards: ['./accent', './surface', './typography', './radius', './shadow'],
  },
  {
    filePath: 'dist/scss/theme/presets/glassmorphism/_index.scss',
    forwards: ['./accent', './surface', './typography', './radius', './shadow'],
  },
];

function renderJavascriptArray(values: string[]): string {
  return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}

export function createTokensPackageJson(config: ScaffoldConfig): string {
  return serializeJson({
    devDependencies: {
      'style-dictionary': '^5.4.0',
    },
    exports: {
      './css': './dist/css/tokens.css',
      './scss': './dist/scss/_tokens.scss',
      './scss/*': './dist/scss/*',
    },
    name: config.tokensPackageName,
    private: true,
    sass: './dist/scss/_tokens.scss',
    scripts: {
      build: 'style-dictionary build --config style-dictionary.config.mjs && node ./scripts/build-scss-index.mjs',
    },
    type: 'module',
    version: '0.1.0',
  });
}

export function createTokensConfig(): string {
  const scssFileEntries = scssTargets
    .map(
      (target) => `  {
    destination: '${target.destination}',
    format: 'scss/variables',
    filter: (token) => normalizePath(token.filePath ?? '').endsWith('${target.source}'),
  },`,
    )
    .join('\n');

  return `const normalizePath = (value) => value.split('\\\\').join('/');

export default {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
        },
      ],
      transformGroup: 'css',
    },
    scss: {
      buildPath: 'dist/scss/',
      files: [
${scssFileEntries}
      ],
      transformGroup: 'scss',
    },
  },
};
`;
}

export function createTokensScssIndexScript(): string {
  const indexFileEntries = scssIndexTargets
    .map(
      (target) => `  {
    filePath: '${target.filePath}',
    forwards: ${renderJavascriptArray(target.forwards)},
  },`,
    )
    .join('\n');

  return `import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const indexFiles = [
${indexFileEntries}
];

for (const indexFile of indexFiles) {
  await mkdir(path.dirname(indexFile.filePath), { recursive: true });
  const content = \`\${indexFile.forwards.map((entry) => \`@forward '\${entry}';\`).join('\\n')}\\n\`;
  await writeFile(indexFile.filePath, content, 'utf8');
}

console.log('SCSS token entrypoints ready.');
`;
}

export function createFoundationAccentTokens(): string {
  return serializeJson({
    color: {
      accent: {
        primary: { value: '#0ea5e9' },
        secondary: { value: '#38bdf8' },
      },
    },
  });
}

export function createFoundationBackgroundTokens(): string {
  return serializeJson({
    color: {
      surface: {
        backdrop: { value: '#fafafa' },
        elevated: { value: '#fafafa' },
        input: { value: '#ffffff' },
        page: { value: '#fafafa' },
        panel: { value: 'rgba(255, 255, 255, 0.92)' },
        spotlight: { value: 'rgba(14, 165, 233, 0.08)' },
        tag: { value: 'rgba(14, 165, 233, 0.1)' },
      },
    },
  });
}

export function createFoundationBreakpointTokens(): string {
  return serializeJson({
    breakpoint: {
      '2xl': { value: '1536px' },
      lg: { value: '1024px' },
      md: { value: '768px' },
      sm: { value: '640px' },
      xl: { value: '1280px' },
      xs: { value: '480px' },
    },
  });
}

export function createFoundationBorderColorTokens(): string {
  return serializeJson({
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

export function createFoundationBorderTokens(): string {
  return serializeJson({
    border: {
      width: {
        default: { value: '1px' },
        focus: { value: '3px' },
      },
    },
  });
}

export function createFoundationEffectTokens(): string {
  return serializeJson({
    effect: {
      surface: {
        backdrop: { value: 'blur(18px)' },
      },
    },
  });
}

export function createFoundationInteractionTokens(): string {
  return serializeJson({
    interaction: {
      active: {
        scale: { value: '0.99' },
        translateY: { value: '1px' },
      },
      disabled: {
        opacity: { value: '0.56' },
      },
      hover: {
        cardLift: { value: '-2px' },
        lift: { value: '-1px' },
      },
    },
  });
}

export function createFoundationColorScaleTokens(): string {
  return serializeJson({
    color: {
      dark: {
        50: { value: '#f8fafc' },
        100: { value: '#f1f5f9' },
        200: { value: '#e2e8f0' },
        300: { value: '#cbd5e1' },
        400: { value: '#94a3b8' },
        500: { value: '#64748b' },
        600: { value: '#475569' },
        700: { value: '#334155' },
        800: { value: '#1e293b' },
        900: { value: '#0f172a' },
        950: { value: '#020617' },
      },
      danger: {
        50: { value: '#fef2f2' },
        100: { value: '#fee2e2' },
        200: { value: '#fecaca' },
        300: { value: '#fca5a5' },
        400: { value: '#f87171' },
        500: { value: '#ef4444' },
        600: { value: '#dc2626' },
        700: { value: '#b91c1c' },
        800: { value: '#991b1b' },
        900: { value: '#7f1d1d' },
        active: { value: '#dc2626' },
        dark: { value: '#dc2626' },
        hover: { value: '#f87171' },
        light: { value: '#f87171' },
        main: { value: '#ef4444' },
      },
      info: {
        50: { value: '#eff6ff' },
        100: { value: '#dbeafe' },
        200: { value: '#bfdbfe' },
        300: { value: '#93c5fd' },
        400: { value: '#60a5fa' },
        500: { value: '#3b82f6' },
        600: { value: '#2563eb' },
        700: { value: '#1d4ed8' },
        800: { value: '#1e40af' },
        900: { value: '#1e3a8a' },
        active: { value: '#2563eb' },
        dark: { value: '#2563eb' },
        hover: { value: '#60a5fa' },
        light: { value: '#60a5fa' },
        main: { value: '#3b82f6' },
      },
      neutral: {
        50: { value: '#fafafa' },
        100: { value: '#f5f5f5' },
        200: { value: '#e5e5e5' },
        300: { value: '#d4d4d4' },
        400: { value: '#a3a3a3' },
        500: { value: '#737373' },
        600: { value: '#525252' },
        700: { value: '#404040' },
        800: { value: '#262626' },
        900: { value: '#171717' },
      },
      primary: {
        50: { value: '#f0f9ff' },
        100: { value: '#e0f2fe' },
        200: { value: '#bae6fd' },
        300: { value: '#7dd3fc' },
        400: { value: '#38bdf8' },
        500: { value: '#0ea5e9' },
        600: { value: '#0284c7' },
        700: { value: '#0369a1' },
        800: { value: '#075985' },
        900: { value: '#0c4a6e' },
        950: { value: '#082f49' },
        active: { value: '#0284c7' },
        dark: { value: '#0284c7' },
        darker: { value: '#0369a1' },
        darkest: { value: '#0c4a6e' },
        disabled: { value: '#bae6fd' },
        focus: { value: '#38bdf8' },
        hover: { value: '#38bdf8' },
        light: { value: '#7dd3fc' },
        lighter: { value: '#e0f2fe' },
        lightest: { value: '#f0f9ff' },
        main: { value: '#0ea5e9' },
      },
      success: {
        50: { value: '#f0fdf4' },
        100: { value: '#dcfce7' },
        200: { value: '#bbf7d0' },
        300: { value: '#86efac' },
        400: { value: '#4ade80' },
        500: { value: '#22c55e' },
        600: { value: '#16a34a' },
        700: { value: '#15803d' },
        800: { value: '#166534' },
        900: { value: '#14532d' },
        active: { value: '#16a34a' },
        dark: { value: '#16a34a' },
        hover: { value: '#4ade80' },
        light: { value: '#4ade80' },
        main: { value: '#22c55e' },
      },
      warning: {
        50: { value: '#fffbeb' },
        100: { value: '#fef3c7' },
        200: { value: '#fde68a' },
        300: { value: '#fcd34d' },
        400: { value: '#fbbf24' },
        500: { value: '#f59e0b' },
        600: { value: '#d97706' },
        700: { value: '#b45309' },
        800: { value: '#92400e' },
        900: { value: '#78350f' },
        active: { value: '#d97706' },
        dark: { value: '#d97706' },
        hover: { value: '#fbbf24' },
        light: { value: '#fbbf24' },
        main: { value: '#f59e0b' },
      },
    },
  });
}

export function createFoundationLayoutTokens(): string {
  return serializeJson({
    layout: {
      container: {
        page: {
          max: { value: '72rem' },
        },
      },
      grid: {
        card: {
          min: { value: '14rem' },
        },
      },
      gutter: {
        page: { value: '1.5rem' },
      },
      measure: {
        reading: { value: '48rem' },
      },
      section: {
        space: {
          hero: { value: '4rem' },
          page: { value: '5rem' },
        },
      },
    },
  });
}

export function createFoundationMotionTokens(): string {
  return serializeJson({
    motion: {
      duration: {
        fast: { value: '160ms' },
        slow: { value: '420ms' },
      },
      easing: {
        emphasized: { value: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        standard: { value: 'cubic-bezier(0.2, 0, 0, 1)' },
      },
    },
  });
}

export function createFoundationRadiusTokens(): string {
  return serializeJson({
    radius: {
      lg: { value: '26px' },
      md: { value: '16px' },
      sm: { value: '10px' },
    },
  });
}

export function createFoundationShadowTokens(): string {
  return serializeJson({
    shadow: {
      lg: { value: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' },
      md: { value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' },
      sm: { value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
      xl: { value: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' },
      button: { value: '0 16px 32px rgba(31, 31, 26, 0.14)' },
      buttonHover: { value: '0 18px 36px rgba(31, 31, 26, 0.2)' },
      card: { value: '0 18px 40px rgba(31, 31, 26, 0.08)' },
      cardHover: { value: '0 22px 46px rgba(31, 31, 26, 0.14)' },
      field: { value: '0 8px 24px rgba(31, 31, 26, 0.04)' },
    },
  });
}

export function createFoundationSemanticColorTokens(): string {
  return serializeJson({
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
      state: {
        error: { value: '#ef4444' },
        info: { value: '#3b82f6' },
        success: { value: '#22c55e' },
        warning: { value: '#f59e0b' },
      },
    },
  });
}

export function createFoundationSpaceTokens(): string {
  return serializeJson({
    space: {
      0: { value: '0' },
      1: { value: '0.25rem' },
      10: { value: '2.5rem' },
      12: { value: '3rem' },
      2: { value: '0.5rem' },
      16: { value: '4rem' },
      20: { value: '5rem' },
      24: { value: '6rem' },
      3: { value: '0.75rem' },
      4: { value: '1rem' },
      5: { value: '1.25rem' },
      6: { value: '1.5rem' },
      7: { value: '2rem' },
      8: { value: '2.5rem' },
      9: { value: '2.25rem' },
      unit: { value: '0.25rem' },
    },
  });
}

export function createFoundationSpacingSemanticTokens(): string {
  return serializeJson({
    body: {
      content: {
        max: { value: '48rem' },
      },
    },
    button: {
      iconGap: { value: '0.5rem' },
      paddingX: {
        lg: { value: '1.5rem' },
        md: { value: '1rem' },
        sm: { value: '0.75rem' },
      },
      paddingY: {
        lg: { value: '0.75rem' },
        md: { value: '0.5rem' },
        sm: { value: '0.25rem' },
      },
    },
    card: {
      gap: { value: '1.5rem' },
      marginBottom: { value: '1.5rem' },
      paddingX: { value: '1.5rem' },
      paddingY: { value: '1.5rem' },
    },
    form: {
      inputHeight: { value: '2.5rem' },
      inputPaddingX: { value: '0.75rem' },
      inputPaddingY: { value: '0.5rem' },
      itemGap: { value: '1rem' },
      labelGap: { value: '0.5rem' },
    },
    list: {
      gap: { value: '0.5rem' },
      itemPaddingX: { value: '1rem' },
      itemPaddingY: { value: '0.75rem' },
    },
    modal: {
      bodyPaddingX: { value: '1.5rem' },
      bodyPaddingY: { value: '1.25rem' },
      footerPaddingX: { value: '1.5rem' },
      footerPaddingY: { value: '1rem' },
      headerPaddingX: { value: '1.5rem' },
      headerPaddingY: { value: '1.25rem' },
      width: {
        lg: { value: '45rem' },
        md: { value: '35rem' },
        sm: { value: '25rem' },
        xl: { value: '60rem' },
      },
    },
    page: {
      gap: { value: '1.5rem' },
      paddingX: { value: '1.5rem' },
      paddingY: { value: '2rem' },
    },
    popup: {
      itemGap: { value: '0.25rem' },
      maxWidth: { value: '17.5rem' },
      minWidth: { value: '10rem' },
      paddingX: { value: '1rem' },
      paddingY: { value: '0.75rem' },
    },
    sidebar: {
      collapsedWidth: { value: '4.5rem' },
      itemGap: { value: '0.5rem' },
      paddingX: { value: '1rem' },
      paddingY: { value: '1rem' },
      width: { value: '16.25rem' },
    },
    table: {
      cellPaddingX: { value: '1rem' },
      cellPaddingY: { value: '0.75rem' },
      headerHeight: { value: '3rem' },
      rowHeight: { value: '3.25rem' },
    },
    topbar: {
      buttonGap: { value: '2.5rem' },
      height: { value: '4rem' },
      itemGap: { value: '1rem' },
      paddingX: { value: '2rem' },
      paddingY: { value: '1rem' },
    },
  });
}

export function createFoundationTextTokens(): string {
  return serializeJson({
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

export function createFoundationTypographyTokens(): string {
  return serializeJson({
    font: {
      family: {
        display: { value: "'Space Grotesk', 'Segoe UI', 'PingFang SC', sans-serif" },
        mono: { value: "'IBM Plex Mono', 'SFMono-Regular', monospace" },
        sans: { value: "'IBM Plex Sans', 'Segoe UI', 'PingFang SC', sans-serif" },
      },
      heading: {
        h1: {
          lineHeight: { value: '1.25' },
          size: { value: '2.25rem' },
          weight: { value: '700' },
        },
        h2: {
          lineHeight: { value: '1.25' },
          size: { value: '1.875rem' },
          weight: { value: '600' },
        },
        h3: {
          lineHeight: { value: '1.375' },
          size: { value: '1.5rem' },
          weight: { value: '600' },
        },
        h4: {
          lineHeight: { value: '1.375' },
          size: { value: '1.25rem' },
          weight: { value: '600' },
        },
        h5: {
          lineHeight: { value: '1.5' },
          size: { value: '1.125rem' },
          weight: { value: '500' },
        },
        h6: {
          lineHeight: { value: '1.5' },
          size: { value: '1rem' },
          weight: { value: '500' },
        },
      },
      letterSpacing: {
        display: { value: '-0.04em' },
        normal: { value: '0' },
        tight: { value: '-0.025em' },
        tighter: { value: '-0.05em' },
        wide: { value: '0.025em' },
        wider: { value: '0.05em' },
      },
      lineHeight: {
        compact: { value: '1.3' },
        loose: { value: '2' },
        normal: { value: '1.5' },
        relaxed: { value: '1.6' },
        snug: { value: '1.375' },
        tight: { value: '1.05' },
      },
      size: {
        body: {
          base: { value: '1rem' },
          lg: { value: '1.125rem' },
          md: { value: '1rem' },
          sm: { value: '0.9375rem' },
          xl: { value: '1.25rem' },
          xs: { value: '0.75rem' },
        },
        display: {
          hero: { value: 'clamp(2.8rem, 6vw, 5.5rem)' },
        },
        heading: {
          '2xl': { value: '1.5rem' },
          '3xl': { value: '1.875rem' },
          '4xl': { value: '2.25rem' },
          '5xl': { value: '3rem' },
          lg: { value: '1.25rem' },
          md: { value: '1.125rem' },
          sm: { value: '1rem' },
          xl: { value: '1.5rem' },
        },
      },
      weight: {
        bold: { value: '700' },
        light: { value: '300' },
        medium: { value: '500' },
        regular: { value: '400' },
        semibold: { value: '600' },
      },
    },
  });
}

export function createFoundationZIndexTokens(): string {
  return serializeJson({
    z: {
      dropdown: { value: '1000' },
      fixed: { value: '1030' },
      modal: { value: '1050' },
      modalBackdrop: { value: '1040' },
      notification: { value: '1080' },
      popover: { value: '1060' },
      sticky: { value: '1020' },
      tooltip: { value: '1070' },
    },
  });
}

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
      surface: {
        backdrop: { value: '#fbf7f2' },
        elevated: { value: 'rgba(255, 255, 255, 0.88)' },
        input: { value: 'rgba(255, 255, 255, 0.9)' },
        page: { value: '#f3efe5' },
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
        default: { value: 'rgba(57, 69, 57, 0.16)' },
        focus: { value: 'rgba(45, 106, 79, 0.4)' },
        strong: { value: 'rgba(57, 69, 57, 0.28)' },
        subtle: { value: 'rgba(57, 69, 57, 0.1)' },
      },
      focus: {
        ring: { value: 'rgba(45, 106, 79, 0.2)' },
      },
    },
  });
}

export function createThemeModeLightTextTokens(): string {
  return createThemeModeTokens('light', {
    color: {
      text: {
        inverse: { value: '#f9faf8' },
        muted: { value: '#5f6358' },
        primary: { value: '#1f1f1a' },
        secondary: { value: '#43483f' },
      },
    },
  });
}

export function createThemeModeLightShadowTokens(): string {
  return createThemeModeTokens('light', {
    shadow: {
      field: { value: '0 8px 24px rgba(31, 31, 26, 0.04)' },
    },
  });
}

export function createThemeModeDarkBackgroundTokens(): string {
  return createThemeModeTokens('dark', {
    color: {
      surface: {
        backdrop: { value: '#07110e' },
        elevated: { value: 'rgba(10, 16, 14, 0.92)' },
        input: { value: 'rgba(13, 21, 18, 0.9)' },
        page: { value: '#08120f' },
        panelBase: { value: 'rgba(12, 19, 17, 0.88)' },
        spotlightBase: { value: 'rgba(14, 22, 18, 0.82)' },
        tagBase: { value: 'rgba(16, 24, 21, 0.9)' },
      },
    },
  });
}

export function createThemeModeDarkBorderTokens(): string {
  return createThemeModeTokens('dark', {
    color: {
      border: {
        default: { value: 'rgba(179, 205, 191, 0.18)' },
        focus: { value: 'rgba(104, 211, 145, 0.48)' },
        strong: { value: 'rgba(179, 205, 191, 0.32)' },
        subtle: { value: 'rgba(179, 205, 191, 0.12)' },
      },
      focus: {
        ring: { value: 'rgba(104, 211, 145, 0.22)' },
      },
    },
  });
}

export function createThemeModeDarkTextTokens(): string {
  return createThemeModeTokens('dark', {
    color: {
      text: {
        inverse: { value: '#07110e' },
        muted: { value: '#9eb0a5' },
        primary: { value: '#eff7f2' },
        secondary: { value: '#c9d8d0' },
      },
    },
  });
}

export function createThemeModeDarkShadowTokens(): string {
  return createThemeModeTokens('dark', {
    shadow: {
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
