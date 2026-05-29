import type { ScaffoldFeatureDefinition } from '@axi/scaffold-kit';
import {
  apiCoreFeature,
  apiHealthSampleFeature,
} from '@axi/scaffold-foundation-api';
import { tokensCoreFeature } from '@axi/scaffold-foundation-design';
import {
  docsCoreFeature,
  toolingCoreFeature,
  workspaceCoreFeature,
} from '@axi/scaffold-foundation-ops';
import { webCoreFeature } from '@axi/scaffold-foundation-web';
import { experimentalSlotShellFeature } from '@axi/scaffold-feature-experimental';
import { hooksPackFeature } from '@axi/scaffold-feature-hooks';
import {
  themePresetFeature,
  themeStyleCyberpunkFeature,
  themeStyleGlassmorphismFeature,
  themeStyleMinimalFeature,
} from '@axi/scaffold-feature-theme';
import { styleSystemFeature, uiComponentsFeature } from '@axi/scaffold-feature-ui';

export const foundationFeatureRegistry = [
  workspaceCoreFeature,
  docsCoreFeature,
  toolingCoreFeature,
  webCoreFeature,
  apiCoreFeature,
  apiHealthSampleFeature,
  tokensCoreFeature,
] as const satisfies readonly ScaffoldFeatureDefinition[];

export const extensionFeatureRegistry = [
  themePresetFeature,
  themeStyleMinimalFeature,
  themeStyleCyberpunkFeature,
  themeStyleGlassmorphismFeature,
  styleSystemFeature,
  uiComponentsFeature,
  hooksPackFeature,
] as const satisfies readonly ScaffoldFeatureDefinition[];

export const experimentalFeatureRegistry = [
  experimentalSlotShellFeature,
] as const satisfies readonly ScaffoldFeatureDefinition[];

export const featureRegistry = [
  ...foundationFeatureRegistry,
  ...extensionFeatureRegistry,
  ...experimentalFeatureRegistry,
] as const satisfies readonly ScaffoldFeatureDefinition[];
