import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createThemePresetMinimalAccentTokens,
  createThemePresetMinimalRadiusTokens,
  createThemePresetMinimalShadowTokens,
  createThemePresetMinimalSurfaceTokens,
  createThemePresetMinimalTypographyTokens,
} from './theme-token-fragments.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

function createThemeStyleDoc(): string {
  return `# Theme Style Minimal

Minimal is the quiet baseline preset.

- neutral accents
- restrained material treatment
- low ornament
- typography-led hierarchy
`;
}

export const themeStyleMinimalManifest = {
  category: 'styling',
  configKey: 'modules.theme-style-minimal.enabled',
  dependencies: ['theme-preset'],
  description: 'Minimal preset with quiet surfaces and restrained ornament.',
  enabledByDefault: true,
  id: 'theme-style-minimal',
  layer: 'extension',
  contributions: [
    {
      type: 'theme-preset',
      data: {
        description: 'Quiet, neutral, and utility-first.',
        id: 'minimal',
        label: 'Minimal',
        thesis: 'The interface recedes so hierarchy, type, and spacing do most of the work.',
      },
    },
  ],
  title: 'Theme Style Minimal',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyThemeStyleMinimal(_context: FeatureRenderContext): ProjectFile[] {
  return [
    {
      path: 'packages/tokens/tokens/theme/presets/minimal/accent.json',
      content: createThemePresetMinimalAccentTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/minimal/surface.json',
      content: createThemePresetMinimalSurfaceTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/minimal/typography.json',
      content: createThemePresetMinimalTypographyTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/minimal/radius.json',
      content: createThemePresetMinimalRadiusTokens(),
    },
    {
      path: 'packages/tokens/tokens/theme/presets/minimal/shadow.json',
      content: createThemePresetMinimalShadowTokens(),
    },
    { path: 'docs/modules/theme-style-minimal.md', content: createThemeStyleDoc() },
  ];
}

export const themeStyleMinimalFeature = defineScaffoldFeature(
  themeStyleMinimalManifest,
  applyThemeStyleMinimal,
);
