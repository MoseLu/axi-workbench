import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createThemeModeDarkBackgroundTokens,
  createThemeModeDarkBorderTokens,
  createThemeModeDarkShadowTokens,
  createThemeModeDarkTextTokens,
  createThemeModeLightBackgroundTokens,
  createThemeModeLightBorderTokens,
  createThemeModeLightShadowTokens,
  createThemeModeLightTextTokens,
} from './theme-token-fragments.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';
import { createThemeRegistry, createThemePreferencesHook, createThemeCompatibilityHook, createThemeCompatibilityHookTest, createThemeCompatibilityIndex, createThemeSwitcher, createThemeSwitcherTest, createThemeRegistryTest, createThemePreferencesTest } from './theme-preset/templates-01.js';
import { createThemeCss, createThemePresetDoc } from './theme-preset/templates-02.js';

export const themePresetManifest = {
  category: 'styling',
  configKey: 'modules.theme-preset.enabled',
  dependencies: ['web-core', 'tokens-core', 'docs-core'],
  description: 'Theme runtime, mode registry, and cartesian composition across installed style presets.',
  enabledByDefault: true,
  id: 'theme-preset',
  layer: 'extension',
  title: 'Theme Preset',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyThemePreset(context: FeatureRenderContext): ProjectFile[] {
  return [
      {
        path: 'packages/tokens/tokens/theme/modes/light/background.json',
        content: createThemeModeLightBackgroundTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/light/border.json',
        content: createThemeModeLightBorderTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/light/text.json',
        content: createThemeModeLightTextTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/light/shadow.json',
        content: createThemeModeLightShadowTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/dark/background.json',
        content: createThemeModeDarkBackgroundTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/dark/border.json',
        content: createThemeModeDarkBorderTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/dark/text.json',
        content: createThemeModeDarkTextTokens(),
      },
      {
        path: 'packages/tokens/tokens/theme/modes/dark/shadow.json',
        content: createThemeModeDarkShadowTokens(),
      },
      {
        path: 'apps/web/src/shared/theme/registry.ts',
        content: createThemeRegistry(context.selectedThemePresetContributions),
      },
      {
        path: 'apps/web/src/shared/theme/useThemePreferences.ts',
        content: createThemePreferencesHook(context.selectedThemePresetContributions),
      },
      {
        path: 'apps/web/src/shared/theme/useTheme.ts',
        content: createThemeCompatibilityHook(),
      },
      {
        path: 'apps/web/src/shared/theme/ThemeSwitcher.tsx',
        content: createThemeSwitcher(),
      },
      {
        path: 'apps/web/src/shared/theme/index.ts',
        content: createThemeCompatibilityIndex(),
      },
      {
        path: 'apps/web/src/shared/theme/__tests__/registry.test.ts',
        content: createThemeRegistryTest(),
      },
      {
        path: 'apps/web/src/shared/theme/__tests__/useThemePreferences.test.tsx',
        content: createThemePreferencesTest(),
      },
      {
        path: 'apps/web/src/shared/theme/__tests__/useTheme.test.tsx',
        content: createThemeCompatibilityHookTest(),
      },
      {
        path: 'apps/web/src/shared/theme/__tests__/ThemeSwitcher.test.tsx',
        content: createThemeSwitcherTest(),
      },
      {
        path: 'apps/web/src/shared/theme/theme.css',
        content: createThemeCss(context.selectedThemePresetContributions),
      },
      {
        path: 'docs/modules/theme-preset.md',
        content: createThemePresetDoc(context.selectedThemePresetContributions),
      },
  ];
}

export const themePresetFeature = defineScaffoldFeature(themePresetManifest, applyThemePreset);
