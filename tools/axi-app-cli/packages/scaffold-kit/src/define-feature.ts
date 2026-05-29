import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldFeatureDefinition,
  ScaffoldModuleManifest,
} from './types.js';

type FeatureApply = (context: FeatureRenderContext) => ProjectFile[];

export function defineScaffoldFeature(
  manifest: ScaffoldModuleManifest,
  apply: FeatureApply,
): ScaffoldFeatureDefinition {
  return {
    apply,
    manifest,
  };
}
