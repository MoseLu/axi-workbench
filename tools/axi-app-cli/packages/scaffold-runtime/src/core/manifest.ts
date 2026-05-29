import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { createScaffoldModuleStates } from '@axi/scaffold-registry';
import type { ProjectFile, ScaffoldConfig, ScaffoldManifest } from '@axi/scaffold-kit';

export const MANIFEST_RELATIVE_PATH = '.axi/scaffold.manifest.json';

const scaffoldModuleStateSchema = z.object({
  enabled: z.boolean(),
  id: z.string().min(1),
  layer: z.enum(['foundation', 'extension', 'experimental']),
  version: z.string().min(1),
});

const scaffoldManifestSchemaV2 = z.object({
  createdAt: z.string().min(1),
  managedFiles: z.array(z.string().min(1)),
  modules: z.array(scaffoldModuleStateSchema),
  packageSlug: z.string().min(1),
  presetId: z.literal('default'),
  projectName: z.string().min(1),
  pythonModuleName: z.string().min(1),
  selectedFeatureIds: z.array(z.string().min(1)).optional(),
  version: z.literal(2),
});

const scaffoldManifestSchemaV1 = z.object({
  createdAt: z.string().min(1),
  managedFiles: z.array(z.string().min(1)),
  packageSlug: z.string().min(1),
  presetId: z.literal('default'),
  projectName: z.string().min(1),
  pythonModuleName: z.string().min(1),
  selectedFeatureIds: z.array(z.string().min(1)),
  version: z.literal(1),
});

function migrateLegacyManifest(rawManifest: z.infer<typeof scaffoldManifestSchemaV1>): ScaffoldManifest {
  return {
    createdAt: rawManifest.createdAt,
    managedFiles: rawManifest.managedFiles,
    modules: createScaffoldModuleStates(rawManifest.selectedFeatureIds),
    packageSlug: rawManifest.packageSlug,
    presetId: rawManifest.presetId,
    projectName: rawManifest.projectName,
    pythonModuleName: rawManifest.pythonModuleName,
    selectedFeatureIds: rawManifest.selectedFeatureIds,
    version: 2,
  };
}

export function resolveManifestPath(targetDir: string): string {
  return path.join(targetDir, MANIFEST_RELATIVE_PATH);
}

export async function readScaffoldManifest(targetDir: string): Promise<ScaffoldManifest> {
  const manifestPath = resolveManifestPath(targetDir);
  const rawManifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (rawManifest.version === 1) {
    return migrateLegacyManifest(scaffoldManifestSchemaV1.parse(rawManifest));
  }

  return scaffoldManifestSchemaV2.parse(rawManifest) satisfies ScaffoldManifest;
}

export function createManifestFile(
  config: ScaffoldConfig,
  managedFiles: string[],
  createdAt?: string,
): ProjectFile {
  const selectedFeatureIds = [...config.selectedFeatureIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const manifest: ScaffoldManifest = {
    createdAt: createdAt ?? new Date().toISOString(),
    managedFiles: [...managedFiles].sort((left, right) => left.localeCompare(right)),
    modules: createScaffoldModuleStates(selectedFeatureIds),
    packageSlug: config.packageSlug,
    presetId: config.presetId,
    projectName: config.projectName,
    pythonModuleName: config.pythonModuleName,
    selectedFeatureIds,
    version: 2,
  };

  return {
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    path: MANIFEST_RELATIVE_PATH,
  };
}
