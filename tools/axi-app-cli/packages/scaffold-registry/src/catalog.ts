import { getPresetDefinition } from './presets/catalog.js';
import type {
  FeatureSummary,
  PresetName,
  ScaffoldFeatureDefinition,
  ScaffoldManifest,
  ScaffoldModuleContribution,
  ScaffoldModuleState,
  ThemePresetContribution,
} from '@axi/scaffold-kit';
import { featureRegistry } from './registry.js';

const featureMap = new Map<string, ScaffoldFeatureDefinition>(
  featureRegistry.map((feature) => [feature.manifest.id, feature]),
);

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function expandFeatureIdsWithDependencies(featureIds: string[]): string[] {
  const expandedFeatureIds: string[] = [];
  const seen = new Set<string>();

  function visit(featureId: string) {
    if (seen.has(featureId)) {
      return;
    }

    const feature = getFeatureDefinition(featureId);
    seen.add(featureId);

    for (const dependencyId of feature.manifest.dependencies ?? []) {
      visit(dependencyId);
    }

    expandedFeatureIds.push(featureId);
  }

  for (const featureId of dedupe(featureIds)) {
    visit(featureId);
  }

  return expandedFeatureIds;
}

function getFeatureDefinitionsByLayer(layer: FeatureSummary['layer']): ScaffoldFeatureDefinition[] {
  return featureRegistry.filter((feature) => feature.manifest.layer === layer);
}

function getDefaultEnabledFeatureIds(presetId: PresetName): string[] {
  const presetDefinition = getPresetDefinition(presetId);
  return [
    ...presetDefinition.modules.foundation,
    ...presetDefinition.modules.extension,
    ...presetDefinition.modules.experimental,
  ];
}

export function getFeatureDefinition(featureId: string): ScaffoldFeatureDefinition {
  const feature = featureMap.get(featureId);

  if (!feature) {
    const knownInstallableFeatureIds = getInstallableFeatureDefinitions()
      .map((entry) => entry.manifest.id)
      .join(', ');

    throw new Error(
      `Unknown feature "${featureId}". Known installable features: ${knownInstallableFeatureIds || 'none'}.`,
    );
  }

  return feature;
}

export function getFeatureSummaries(): FeatureSummary[] {
  return featureRegistry.map((feature) => {
    const { contributions: _contributions, ...summary } = feature.manifest;
    return { ...summary };
  });
}

export function getFoundationFeatureDefinitions(): ScaffoldFeatureDefinition[] {
  return getFeatureDefinitionsByLayer('foundation');
}

export function getInstallableFeatureDefinitions(): ScaffoldFeatureDefinition[] {
  return featureRegistry.filter((feature) => feature.manifest.layer !== 'foundation');
}

export function getExtensionFeatureDefinitions(): ScaffoldFeatureDefinition[] {
  return getFeatureDefinitionsByLayer('extension');
}

export function getExperimentalFeatureDefinitions(): ScaffoldFeatureDefinition[] {
  return getFeatureDefinitionsByLayer('experimental');
}

export function getInstallableFeatureSummaries(): FeatureSummary[] {
  return getInstallableFeatureDefinitions().map((feature) => {
    const { contributions: _contributions, ...summary } = feature.manifest;
    return summary;
  });
}

export function validateInstallableFeatureIds(featureIds: string[]): string[] {
  const validatedFeatureIds = dedupe(featureIds).map((featureId) => {
    const feature = getFeatureDefinition(featureId);

    if (feature.manifest.layer === 'foundation') {
      throw new Error(`Feature "${featureId}" is a foundation module and cannot be added directly.`);
    }

    return featureId;
  });

  return expandFeatureIdsWithDependencies(validatedFeatureIds).filter((featureId) => {
    const feature = getFeatureDefinition(featureId);
    return feature.manifest.layer !== 'foundation';
  });
}

export function resolveEnabledFeatureIds(featureIds: string[]): string[] {
  return expandFeatureIdsWithDependencies(featureIds);
}

export function resolveFeatureDefinitions(featureIds: string[]): ScaffoldFeatureDefinition[] {
  return resolveEnabledFeatureIds(featureIds).map((featureId) => getFeatureDefinition(featureId));
}

export function resolveFeatureIdsForPreset(
  presetId: PresetName,
  installableFeatureIds: string[],
): string[] {
  const validatedInstallableFeatureIds = validateInstallableFeatureIds(installableFeatureIds);
  return resolveEnabledFeatureIds([
    ...getDefaultEnabledFeatureIds(presetId),
    ...validatedInstallableFeatureIds,
  ]);
}

export function getPresetInstallableDefaults(presetId: PresetName): string[] {
  return getDefaultEnabledFeatureIds(presetId).filter((featureId) => {
    const feature = getFeatureDefinition(featureId);
    return feature.manifest.layer !== 'foundation';
  });
}

export function getEnabledFeatureIdsFromManifest(manifest: ScaffoldManifest): string[] {
  if (manifest.modules.length > 0) {
    return manifest.modules.filter((module) => module.enabled).map((module) => module.id);
  }

  return [...(manifest.selectedFeatureIds ?? [])];
}

export function getEnabledInstallableFeatureIdsFromManifest(manifest: ScaffoldManifest): string[] {
  return getEnabledFeatureIdsFromManifest(manifest).filter((featureId) => {
    const feature = getFeatureDefinition(featureId);
    return feature.manifest.layer !== 'foundation';
  });
}

export function createScaffoldModuleStates(enabledFeatureIds: string[]): ScaffoldModuleState[] {
  const enabledFeatureIdSet = new Set(resolveEnabledFeatureIds(enabledFeatureIds));

  return getFeatureSummaries()
    .map((feature) => ({
      enabled: enabledFeatureIdSet.has(feature.id),
      id: feature.id,
      layer: feature.layer,
      version: feature.version,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getFeatureContributions<TData = unknown>(
  featureIds: string[],
  type: string,
): Array<ScaffoldModuleContribution<string, TData>> {
  return resolveFeatureDefinitions(featureIds)
    .flatMap((feature) => feature.manifest.contributions ?? [])
    .filter(
      (contribution): contribution is ScaffoldModuleContribution<string, TData> =>
        contribution.type === type,
    );
}

export function getThemePresetContributions(featureIds: string[]): ThemePresetContribution[] {
  return getFeatureContributions<ThemePresetContribution>(featureIds, 'theme-preset').map(
    (contribution) => contribution.data,
  );
}
