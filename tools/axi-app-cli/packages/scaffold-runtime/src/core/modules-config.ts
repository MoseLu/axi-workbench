import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { getFeatureSummaries, resolveEnabledFeatureIds } from '@axi/scaffold-registry';
import type {
  ProjectFile,
  PresetName,
  ScaffoldConfig,
  ScaffoldModulesConfig,
  ScaffoldModulesConfigEntry,
} from '@axi/scaffold-kit';

export const MODULES_CONFIG_RELATIVE_PATH = '.axi/modules.json';

const scaffoldModulesConfigEntrySchema = z.object({
  configKey: z.string().min(1),
  enabled: z.boolean(),
  layer: z.enum(['foundation', 'extension', 'experimental']),
  version: z.string().min(1),
});

const scaffoldModulesConfigSchema = z.object({
  modules: z.record(z.string().min(1), scaffoldModulesConfigEntrySchema),
  presetId: z.literal('default'),
  version: z.literal(1),
});

export function resolveModulesConfigPath(targetDir: string): string {
  return path.join(targetDir, MODULES_CONFIG_RELATIVE_PATH);
}

export async function readScaffoldModulesConfig(
  targetDir: string,
): Promise<ScaffoldModulesConfig | undefined> {
  const modulesConfigPath = resolveModulesConfigPath(targetDir);

  try {
    const rawModulesConfig = JSON.parse(await readFile(modulesConfigPath, 'utf8'));
    return scaffoldModulesConfigSchema.parse(rawModulesConfig) satisfies ScaffoldModulesConfig;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined;
    }

    throw error;
  }
}

export function getEnabledFeatureIdsFromModulesConfig(
  modulesConfig: ScaffoldModulesConfig,
): string[] {
  return Object.entries(modulesConfig.modules)
    .filter(([, moduleConfig]) => moduleConfig.enabled)
    .map(([featureId]) => featureId)
    .sort((left, right) => left.localeCompare(right));
}

export function createScaffoldModulesConfig(
  presetId: PresetName,
  enabledFeatureIds: string[],
): ScaffoldModulesConfig {
  const enabledFeatureIdSet = new Set(resolveEnabledFeatureIds(enabledFeatureIds));
  const moduleEntries: Array<[string, ScaffoldModulesConfigEntry]> = getFeatureSummaries()
    .map(
      (feature): [string, ScaffoldModulesConfigEntry] => [
        feature.id,
        {
          configKey: feature.configKey,
          enabled: enabledFeatureIdSet.has(feature.id),
          layer: feature.layer,
          version: feature.version,
        },
      ],
    )
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
  const modules = Object.fromEntries(moduleEntries);
  return {
    modules,
    presetId,
    version: 1,
  };
}

export function createModulesConfigFile(config: ScaffoldConfig): ProjectFile {
  const modulesConfig = createScaffoldModulesConfig(config.presetId, config.selectedFeatureIds);

  return {
    content: `${JSON.stringify(modulesConfig, null, 2)}\n`,
    path: MODULES_CONFIG_RELATIVE_PATH,
  };
}
