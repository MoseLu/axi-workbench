import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createThemePresetGlassmorphismAccentTokens,
  createThemePresetGlassmorphismRadiusTokens,
  createThemePresetGlassmorphismShadowTokens,
  createThemePresetGlassmorphismSurfaceTokens,
  createThemePresetGlassmorphismTypographyTokens,
} from './theme-token-fragments.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

function createThemeStyleDoc(): string {
  return `# Theme Style Glassmorphism

Glassmorphism is the atmospheric translucent preset.

- frosted panel surfaces
- deeper blur
- softer highlight contrast
- fluid layered depth
`;
}

export const themeStyleGlassmorphismManifest = {
  category: 'styling',
  configKey: 'modules.theme-style-glassmorphism.enabled',
  dependencies: ['theme-preset'],
  description: 'Glassmorphism preset with translucent surfaces and layered blur depth.',
  enabledByDefault: true,
  id: 'theme-style-glassmorphism',
  layer: 'extension',
  contributions: [
    {
      type: 'theme-preset',
      data: {
        description: 'Frosted panels, layered blur, and soft atmospheric depth.',
        id: 'glassmorphism',
        label: 'Glassmorphism',
        thesis: 'Translucent surfaces and softer highlights create depth without heavy chrome.',
      },
    },
  ],
  title: 'Theme Style Glassmorphism',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyThemeStyleGlassmorphism(_context: FeatureRenderContext): ProjectFile[] {
  return [
    {
      path: 'packages/tokens/tokens/theme/presets/glassmorphism/accent.json',
      content: createThemePresetGlassmorphismAccentTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/glassmorphism/surface.json',
      content: createThemePresetGlassmorphismSurfaceTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/glassmorphism/typography.json',
      content: createThemePresetGlassmorphismTypographyTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/glassmorphism/radius.json',
      content: createThemePresetGlassmorphismRadiusTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/glassmorphism/shadow.json',
      content: createThemePresetGlassmorphismShadowTokens(),
    },
    { path: 'docs/modules/theme-style-glassmorphism.md', content: createThemeStyleDoc() },
  ];
}

export const themeStyleGlassmorphismFeature = defineScaffoldFeature(
  themeStyleGlassmorphismManifest,
  applyThemeStyleGlassmorphism,
);
