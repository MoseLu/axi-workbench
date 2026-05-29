import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createThemePresetCyberpunkAccentTokens,
  createThemePresetCyberpunkRadiusTokens,
  createThemePresetCyberpunkShadowTokens,
  createThemePresetCyberpunkSurfaceTokens,
  createThemePresetCyberpunkTypographyTokens,
} from './theme-token-fragments.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

function createThemeStyleDoc(): string {
  return `# Theme Style Cyberpunk

Cyberpunk is the high-energy preset.

- neon accent contrast
- sharper geometry
- denser glow treatment
- stronger techno atmosphere
`;
}

export const themeStyleCyberpunkManifest = {
  category: 'styling',
  configKey: 'modules.theme-style-cyberpunk.enabled',
  dependencies: ['theme-preset'],
  description: 'Cyberpunk preset with neon accents, sharper geometry, and stronger atmosphere.',
  enabledByDefault: true,
  id: 'theme-style-cyberpunk',
  layer: 'extension',
  contributions: [
    {
      type: 'theme-preset',
      data: {
        description: 'Sharper geometry, neon edges, and electric accent contrast.',
        id: 'cyberpunk',
        label: 'Cyberpunk',
        thesis: 'Glow, stronger borders, and dense energy without turning the UI into a toy.',
      },
    },
  ],
  title: 'Theme Style Cyberpunk',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyThemeStyleCyberpunk(_context: FeatureRenderContext): ProjectFile[] {
  return [
    {
      path: 'packages/tokens/tokens/theme/presets/cyberpunk/accent.json',
      content: createThemePresetCyberpunkAccentTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/cyberpunk/surface.json',
      content: createThemePresetCyberpunkSurfaceTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/cyberpunk/typography.json',
      content: createThemePresetCyberpunkTypographyTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/cyberpunk/radius.json',
      content: createThemePresetCyberpunkRadiusTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/cyberpunk/shadow.json',
      content: createThemePresetCyberpunkShadowTokens(),
    },
    { path: 'docs/modules/theme-style-cyberpunk.md', content: createThemeStyleDoc() },
  ];
}

export const themeStyleCyberpunkFeature = defineScaffoldFeature(
  themeStyleCyberpunkManifest,
  applyThemeStyleCyberpunk,
);
