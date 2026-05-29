import { stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  getEnabledFeatureIdsFromManifest,
  getFeatureDefinition,
  getFeatureSummaries,
  resolveEnabledFeatureIds,
} from '@axi/scaffold-registry';
import type {
  FeatureLayer,
  FeatureSummary,
  ScaffoldManifest,
  ScaffoldModulesConfig,
} from '@axi/scaffold-kit';
import {
  createScaffoldModulesConfig,
  getEnabledFeatureIdsFromModulesConfig,
  readScaffoldModulesConfig,
  resolveModulesConfigPath,
} from './modules-config.js';
import { readScaffoldManifest } from './manifest.js';

interface LoadedProjectState {
  appliedEnabledFeatureIds: string[];
  desiredEnabledFeatureIds: string[];
  driftDetected: boolean;
  manifest: ScaffoldManifest;
  modulesConfig?: ScaffoldModulesConfig;
}

interface ListModuleReport {
  configKey: string;
  description: string;
  id: string;
  layer: FeatureLayer;
  status: 'enabled' | 'enabled_pending_sync' | 'disabled' | 'disabled_stale_applied';
  title: string;
  version: string;
}

export interface ListReport {
  appliedEnabledFeatureIds: string[];
  desiredEnabledFeatureIds: string[];
  layers: Record<FeatureLayer, ListModuleReport[]>;
  presetId: string;
  projectName: string;
  state: 'drift_detected' | 'in_sync' | 'modules_config_missing';
}

export interface DoctorReport {
  errors: string[];
  fixed: boolean;
  hasModulesConfig: boolean;
  ok: boolean;
  presetId: string;
  projectName: string;
  warnings: string[];
}

interface DoctorCommandOptions {
  fix?: boolean;
  json?: boolean;
  syncProject?: () => Promise<void>;
}

interface ListCommandOptions {
  json?: boolean;
}

const layerOrder: FeatureLayer[] = ['foundation', 'extension', 'experimental'];

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatLayerHeading(layer: FeatureLayer): string {
  return `${layer.charAt(0).toUpperCase()}${layer.slice(1)} Modules`;
}

function getModuleStatus(
  featureId: string,
  desiredEnabledFeatureIdSet: Set<string>,
  appliedEnabledFeatureIdSet: Set<string>,
): ListModuleReport['status'] {
  const desiredEnabled = desiredEnabledFeatureIdSet.has(featureId);
  const appliedEnabled = appliedEnabledFeatureIdSet.has(featureId);

  if (desiredEnabled && appliedEnabled) {
    return 'enabled';
  }

  if (desiredEnabled && !appliedEnabled) {
    return 'enabled_pending_sync';
  }

  if (!desiredEnabled && appliedEnabled) {
    return 'disabled_stale_applied';
  }

  return 'disabled';
}

function formatModuleStatus(status: ListModuleReport['status']): string {
  switch (status) {
    case 'enabled_pending_sync':
      return 'enabled (pending sync)';
    case 'disabled_stale_applied':
      return 'disabled (stale applied state)';
    default:
      return status;
  }
}

async function loadProjectState(targetDir: string): Promise<LoadedProjectState> {
  const manifest = await readScaffoldManifest(targetDir);
  const modulesConfig = await readScaffoldModulesConfig(targetDir);
  const appliedEnabledFeatureIds = getEnabledFeatureIdsFromManifest(manifest).sort((left, right) =>
    left.localeCompare(right),
  );
  const desiredEnabledFeatureIds = modulesConfig
    ? resolveEnabledFeatureIds(getEnabledFeatureIdsFromModulesConfig(modulesConfig)).sort((left, right) =>
        left.localeCompare(right),
      )
    : appliedEnabledFeatureIds;

  return {
    appliedEnabledFeatureIds,
    desiredEnabledFeatureIds,
    driftDetected: !sameIds(desiredEnabledFeatureIds, appliedEnabledFeatureIds),
    manifest,
    modulesConfig,
  };
}

function createListReport(projectState: LoadedProjectState): ListReport {
  const featureSummaries = getFeatureSummaries();
  const desiredEnabledFeatureIdSet = new Set(projectState.desiredEnabledFeatureIds);
  const appliedEnabledFeatureIdSet = new Set(projectState.appliedEnabledFeatureIds);

  return {
    appliedEnabledFeatureIds: projectState.appliedEnabledFeatureIds,
    desiredEnabledFeatureIds: projectState.desiredEnabledFeatureIds,
    layers: {
      foundation: featureSummaries
        .filter((feature) => feature.layer === 'foundation')
        .map((feature) => ({
          configKey: feature.configKey,
          description: feature.description,
          id: feature.id,
          layer: feature.layer,
          status: getModuleStatus(feature.id, desiredEnabledFeatureIdSet, appliedEnabledFeatureIdSet),
          title: feature.title,
          version: feature.version,
        })),
      extension: featureSummaries
        .filter((feature) => feature.layer === 'extension')
        .map((feature) => ({
          configKey: feature.configKey,
          description: feature.description,
          id: feature.id,
          layer: feature.layer,
          status: getModuleStatus(feature.id, desiredEnabledFeatureIdSet, appliedEnabledFeatureIdSet),
          title: feature.title,
          version: feature.version,
        })),
      experimental: featureSummaries
        .filter((feature) => feature.layer === 'experimental')
        .map((feature) => ({
          configKey: feature.configKey,
          description: feature.description,
          id: feature.id,
          layer: feature.layer,
          status: getModuleStatus(feature.id, desiredEnabledFeatureIdSet, appliedEnabledFeatureIdSet),
          title: feature.title,
          version: feature.version,
        })),
    },
    presetId: projectState.manifest.presetId,
    projectName: projectState.manifest.projectName,
    state: projectState.modulesConfig
      ? projectState.driftDetected
        ? 'drift_detected'
        : 'in_sync'
      : 'modules_config_missing',
  };
}

function compareManifestModuleMetadata(manifest: ScaffoldManifest): string[] {
  const warnings: string[] = [];

  for (const moduleState of manifest.modules) {
    const feature = getFeatureDefinition(moduleState.id);

    if (moduleState.layer !== feature.manifest.layer) {
      warnings.push(
        `Manifest layer mismatch for "${moduleState.id}": expected ${feature.manifest.layer}, found ${moduleState.layer}.`,
      );
    }

    if (moduleState.version !== feature.manifest.version) {
      warnings.push(
        `Manifest version mismatch for "${moduleState.id}": expected ${feature.manifest.version}, found ${moduleState.version}.`,
      );
    }
  }

  return warnings;
}

function compareModulesConfigMetadata(modulesConfig: ScaffoldModulesConfig): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const knownFeatureIds = new Set(getFeatureSummaries().map((feature) => feature.id));

  for (const featureId of Object.keys(modulesConfig.modules)) {
    if (!knownFeatureIds.has(featureId)) {
      errors.push(`Unknown module in .axi/modules.json: "${featureId}".`);
      continue;
    }

    const moduleConfig = modulesConfig.modules[featureId];
    const feature = getFeatureDefinition(featureId);

    if (moduleConfig.configKey !== feature.manifest.configKey) {
      warnings.push(
        `Module config key mismatch for "${featureId}": expected ${feature.manifest.configKey}, found ${moduleConfig.configKey}.`,
      );
    }

    if (moduleConfig.layer !== feature.manifest.layer) {
      warnings.push(
        `Module layer mismatch for "${featureId}": expected ${feature.manifest.layer}, found ${moduleConfig.layer}.`,
      );
    }

    if (moduleConfig.version !== feature.manifest.version) {
      warnings.push(
        `Module version mismatch for "${featureId}": expected ${feature.manifest.version}, found ${moduleConfig.version}.`,
      );
    }
  }

  for (const feature of getFeatureSummaries()) {
    if (!modulesConfig.modules[feature.id]) {
      errors.push(`Missing module entry in .axi/modules.json: "${feature.id}".`);
    }
  }

  return { errors, warnings };
}

function validateModuleDependencies(modulesConfig: ScaffoldModulesConfig): string[] {
  const errors: string[] = [];
  const enabledFeatureIds = getEnabledFeatureIdsFromModulesConfig(modulesConfig);
  const enabledFeatureIdSet = new Set(enabledFeatureIds);

  for (const featureId of enabledFeatureIds) {
    const feature = getFeatureDefinition(featureId);

    for (const dependencyId of feature.manifest.dependencies ?? []) {
      if (!enabledFeatureIdSet.has(dependencyId)) {
        errors.push(
          `Module "${featureId}" is enabled in .axi/modules.json but dependency "${dependencyId}" is disabled.`,
        );
      }
    }
  }

  return errors;
}

async function validateManagedFiles(targetDir: string, manifest: ScaffoldManifest): Promise<string[]> {
  const errors: string[] = [];

  for (const managedFile of manifest.managedFiles) {
    const absolutePath = path.join(targetDir, managedFile);

    try {
      const entryStats = await stat(absolutePath);

      if (!entryStats.isFile()) {
        errors.push(`Managed path is not a file: ${managedFile}`);
      }
    } catch {
      errors.push(`Managed file is missing: ${managedFile}`);
    }
  }

  return errors;
}

async function createDoctorReport(targetDir: string, projectState: LoadedProjectState): Promise<DoctorReport> {
  const errors: string[] = [];
  const warnings = compareManifestModuleMetadata(projectState.manifest);

  if (!projectState.modulesConfig) {
    errors.push('Missing .axi/modules.json. Run `axi sync --cwd .` to regenerate the module policy.');
  } else {
    const configValidation = compareModulesConfigMetadata(projectState.modulesConfig);
    errors.push(...configValidation.errors);
    warnings.push(...configValidation.warnings);
    errors.push(...validateModuleDependencies(projectState.modulesConfig));

    if (projectState.driftDetected) {
      errors.push(
        'Scaffold drift detected between .axi/modules.json and .axi/scaffold.manifest.json. Run `axi sync --cwd .`.',
      );
    }
  }

  errors.push(...(await validateManagedFiles(targetDir, projectState.manifest)));

  return {
    errors,
    fixed: false,
    hasModulesConfig: projectState.modulesConfig !== undefined,
    ok: errors.length === 0,
    presetId: projectState.manifest.presetId,
    projectName: projectState.manifest.projectName,
    warnings,
  };
}

function normalizeEnabledFeatureIdsForRepair(projectState: LoadedProjectState): string[] {
  const appliedEnabledFeatureIdSet = new Set(projectState.appliedEnabledFeatureIds);

  return getFeatureSummaries()
    .filter((feature) => {
      const moduleConfig = projectState.modulesConfig?.modules[feature.id];
      return moduleConfig ? moduleConfig.enabled : appliedEnabledFeatureIdSet.has(feature.id);
    })
    .map((feature) => feature.id);
}

async function repairProjectState(
  targetDir: string,
  projectState: LoadedProjectState,
  syncProject?: () => Promise<void>,
): Promise<void> {
  const repairedModulesConfig = createScaffoldModulesConfig(
    projectState.manifest.presetId,
    normalizeEnabledFeatureIdsForRepair(projectState),
  );
  const modulesConfigPath = resolveModulesConfigPath(targetDir);

  await writeFile(modulesConfigPath, `${JSON.stringify(repairedModulesConfig, null, 2)}\n`, 'utf8');

  if (syncProject) {
    await syncProject();
  }
}

export async function runListCommand(
  targetDir: string,
  options: ListCommandOptions = {},
): Promise<ListReport> {
  const report = createListReport(await loadProjectState(targetDir));

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  console.log(`[axi] project: ${report.projectName}`);
  console.log(`[axi] preset: ${report.presetId}`);
  console.log(
    `[axi] state: ${
      report.state === 'drift_detected'
        ? 'drift detected (run `axi sync --cwd .`)'
        : report.state === 'modules_config_missing'
          ? 'modules config missing (showing applied snapshot)'
          : 'in sync'
    }`,
  );

  for (const layer of layerOrder) {
    console.log('');
    console.log(formatLayerHeading(layer));

    const modules = report.layers[layer];

    if (modules.length === 0) {
      console.log('- none');
      continue;
    }

    for (const module of modules) {
      console.log(`- ${module.id} [${formatModuleStatus(module.status)}] ${module.title}`);
    }
  }

  return report;
}

export async function runDoctorCommand(
  targetDir: string,
  options: DoctorCommandOptions = {},
): Promise<DoctorReport> {
  let projectState = await loadProjectState(targetDir);
  let report = await createDoctorReport(targetDir, projectState);

  if (options.fix && !report.ok) {
    await repairProjectState(targetDir, projectState, options.syncProject);
    projectState = await loadProjectState(targetDir);
    report = {
      ...(await createDoctorReport(targetDir, projectState)),
      fixed: true,
    };
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  if (report.warnings.length > 0) {
    console.log('[axi] doctor warnings:');

    for (const warning of report.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (!report.ok) {
    throw new Error(['Doctor failed:', ...report.errors.map((error) => `- ${error}`)].join('\n'));
  }

  if (report.fixed) {
    console.log('[axi] doctor repaired scaffold state via sync.');
  }

  console.log(`[axi] doctor passed for ${report.projectName}`);
  return report;
}
