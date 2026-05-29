import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';
import {
  createFoundationAccentTokens,
  createFoundationBackgroundTokens,
  createFoundationBreakpointTokens,
  createFoundationBorderColorTokens,
  createFoundationBorderTokens,
  createFoundationColorScaleTokens,
  createFoundationEffectTokens,
  createFoundationInteractionTokens,
  createFoundationLayoutTokens,
  createFoundationMotionTokens,
  createFoundationRadiusTokens,
  createFoundationSemanticColorTokens,
  createFoundationShadowTokens,
  createFoundationSpaceTokens,
  createFoundationSpacingSemanticTokens,
  createFoundationTextTokens,
  createFoundationTypographyTokens,
  createFoundationZIndexTokens,
  createTokensConfig,
  createTokensPackageJson,
  createTokensScssIndexScript,
} from '../templates/generated-tokens.js';

export const tokensCoreManifest = {
  category: 'styling',
  configKey: 'modules.tokens-core.enabled',
  dependencies: ['workspace-core'],
  description: 'Base design-token package with Style Dictionary outputs for CSS and SCSS.',
  enabledByDefault: true,
  id: 'tokens-core',
  layer: 'foundation',
  title: 'Tokens Core',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyTokensCore(context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: 'packages/tokens/package.json', content: createTokensPackageJson(context) },
    { path: 'packages/tokens/style-dictionary.config.mjs', content: createTokensConfig() },
    {
      path: 'packages/tokens/scripts/build-scss-index.mjs',
      content: createTokensScssIndexScript(),
    },
    { path: 'packages/tokens/tokens/foundation/accent.json', content: createFoundationAccentTokens() },
    {
      path: 'packages/tokens/tokens/foundation/background.json',
      content: createFoundationBackgroundTokens(),
    },
    {
      path: 'packages/tokens/tokens/foundation/breakpoint.json',
      content: createFoundationBreakpointTokens(),
    },
    {
      path: 'packages/tokens/tokens/foundation/border-color.json',
      content: createFoundationBorderColorTokens(),
    },
    { path: 'packages/tokens/tokens/foundation/border.json', content: createFoundationBorderTokens() },
    {
      path: 'packages/tokens/tokens/foundation/color-scale.json',
      content: createFoundationColorScaleTokens(),
    },
    { path: 'packages/tokens/tokens/foundation/effect.json', content: createFoundationEffectTokens() },
    {
      path: 'packages/tokens/tokens/foundation/typography.json',
      content: createFoundationTypographyTokens(),
    },
    {
      path: 'packages/tokens/tokens/foundation/interaction.json',
      content: createFoundationInteractionTokens(),
    },
    { path: 'packages/tokens/tokens/foundation/layout.json', content: createFoundationLayoutTokens() },
    { path: 'packages/tokens/tokens/foundation/motion.json', content: createFoundationMotionTokens() },
    {
      path: 'packages/tokens/tokens/foundation/radius.json',
      content: createFoundationRadiusTokens(),
    },
    {
      path: 'packages/tokens/tokens/foundation/semantic-color.json',
      content: createFoundationSemanticColorTokens(),
    },
    { path: 'packages/tokens/tokens/foundation/shadow.json', content: createFoundationShadowTokens() },
    { path: 'packages/tokens/tokens/foundation/space.json', content: createFoundationSpaceTokens() },
    {
      path: 'packages/tokens/tokens/foundation/spacing-semantic.json',
      content: createFoundationSpacingSemanticTokens(),
    },
    { path: 'packages/tokens/tokens/foundation/text.json', content: createFoundationTextTokens() },
    { path: 'packages/tokens/tokens/foundation/z-index.json', content: createFoundationZIndexTokens() },
  ];
}

export const tokensCoreFeature = defineScaffoldFeature(tokensCoreManifest, applyTokensCore);
