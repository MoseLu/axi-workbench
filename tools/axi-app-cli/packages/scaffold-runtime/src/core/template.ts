import { createManifestFile } from './manifest.js';
import { createModulesConfigFile } from './modules-config.js';
import {
  getInstallableFeatureSummaries,
  getThemePresetContributions,
  resolveFeatureDefinitions,
} from '@axi/scaffold-registry';
import type { FeatureRenderContext, ProjectFile, ScaffoldConfig } from '@axi/scaffold-kit';

function dedupeProjectFiles(projectFiles: ProjectFile[]): ProjectFile[] {
  const projectFileMap = new Map<string, ProjectFile>();

  for (const projectFile of projectFiles) {
    projectFileMap.set(projectFile.path, projectFile);
  }

  return [...projectFileMap.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function buildFeatureRenderContext(config: ScaffoldConfig): FeatureRenderContext {
  const selectedFeatureDefinitions = resolveFeatureDefinitions(config.selectedFeatureIds);

  return {
    ...config,
    availableInstallableFeatures: getInstallableFeatureSummaries(),
    selectedFeatureSummaries: selectedFeatureDefinitions.map((feature) => {
      const { contributions: _contributions, ...summary } = feature.manifest;
      return summary;
    }),
    selectedThemePresetContributions: getThemePresetContributions(config.selectedFeatureIds),
  };
}

export function renderProjectFiles(config: ScaffoldConfig): ProjectFile[] {
  const featureContext = buildFeatureRenderContext(config);
  const selectedFeatureDefinitions = resolveFeatureDefinitions(config.selectedFeatureIds);
  const renderedFiles = dedupeProjectFiles(
    selectedFeatureDefinitions.flatMap((feature) => feature.apply(featureContext)),
  );
  const managedFilePaths = [
    ...renderedFiles.map((projectFile) => projectFile.path),
    '.axi/modules.json',
    '.axi/scaffold.manifest.json',
  ];
  const modulesConfigFile = createModulesConfigFile(config);
  const manifestFile = createManifestFile(config, managedFilePaths, config.manifest?.createdAt);

  return dedupeProjectFiles([...renderedFiles, modulesConfigFile, manifestFile]);
}
