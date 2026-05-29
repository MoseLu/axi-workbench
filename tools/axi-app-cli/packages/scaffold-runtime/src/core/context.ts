import path from 'node:path';

import { z } from 'zod';

import {
  getEnabledFeatureIdsFromManifest,
  getInstallableFeatureDefinitions,
  getPresetInstallableDefaults,
  getFeatureDefinition,
  resolveEnabledFeatureIds,
  resolveFeatureIdsForPreset,
  validateInstallableFeatureIds,
} from '@axi/scaffold-registry';
import type { ParsedArgs, PromptState, ScaffoldConfig } from '@axi/scaffold-kit';
import { readScaffoldManifest } from './manifest.js';
import {
  getEnabledFeatureIdsFromModulesConfig,
  readScaffoldModulesConfig,
} from './modules-config.js';
import { promptForScaffoldConfig } from './prompts.js';

const scaffoldConfigSchema = z.object({
  command: z.enum(['init', 'create', 'add', 'sync']),
  cwd: z.string().min(1),
  featureIds: z.array(z.string()),
  fix: z.boolean(),
  install: z.boolean(),
  interactive: z.boolean(),
  invokedName: z.string().min(1),
  json: z.boolean(),
  manifest: z
    .object({
      createdAt: z.string().min(1),
      managedFiles: z.array(z.string().min(1)),
      modules: z.array(
        z.object({
          enabled: z.boolean(),
          id: z.string().min(1),
          layer: z.enum(['foundation', 'extension', 'experimental']),
          version: z.string().min(1),
        }),
      ),
      packageSlug: z.string().min(1),
      presetId: z.literal('default'),
      projectName: z.string().min(1),
      pythonModuleName: z.string().min(1),
      selectedFeatureIds: z.array(z.string().min(1)).optional(),
      version: z.literal(2),
    })
    .optional(),
  manifestPath: z.string().min(1),
  mode: z.enum(['interactive', 'default']),
  installableFeatureIds: z.array(z.string()),
  packageSlug: z.string().min(1),
  presetId: z.literal('default'),
  projectName: z.string().min(1),
  pythonModuleName: z.string().min(1),
  scope: z.string().min(1),
  selectedFeatureIds: z.array(z.string().min(1)),
  targetDir: z.string().min(1),
  template: z.literal('default'),
  tokensPackageName: z.string().min(1),
  verify: z.boolean(),
  webPackageName: z.string().min(1),
  yes: z.boolean(),
});

function hasInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function normalizeProjectName(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : 'axi-app';
}

function toPackageSlug(projectName: string): string {
  const normalized = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    return 'axi-app';
  }

  return /^\d/.test(normalized) ? `app-${normalized}` : normalized;
}

function toPythonModuleName(packageSlug: string): string {
  const normalized = packageSlug.replace(/-/g, '_');
  return /^\d/.test(normalized) ? `app_${normalized}` : normalized;
}

function resolveMode(parsedArgs: ParsedArgs): 'interactive' | 'default' {
  return parsedArgs.yes || !hasInteractiveTerminal() ? 'default' : 'interactive';
}

function buildPromptState(parsedArgs: ParsedArgs & { command: 'init' | 'create' }): PromptState {
  const defaultInstallableFeatureIds = getPresetInstallableDefaults('default');
  const defaultProjectName =
    parsedArgs.command === 'create'
      ? normalizeProjectName(parsedArgs.projectName ?? 'axi-app')
      : normalizeProjectName(path.basename(parsedArgs.cwd) || 'axi-app');

  return {
    command: parsedArgs.command,
    featureIds: validateInstallableFeatureIds([
      ...defaultInstallableFeatureIds,
      ...parsedArgs.featureIds,
    ]),
    install: parsedArgs.install,
    projectName: defaultProjectName,
    targetDir:
      parsedArgs.command === 'create'
        ? path.resolve(parsedArgs.cwd, defaultProjectName)
        : parsedArgs.cwd,
    template: parsedArgs.template,
    verify: parsedArgs.install && parsedArgs.verify,
  };
}

async function resolvePromptState(
  parsedArgs: ParsedArgs & { command: 'init' | 'create' },
): Promise<PromptState> {
  const initialState = buildPromptState(parsedArgs);

  if (parsedArgs.yes) {
    return initialState;
  }

  if (!parsedArgs.interactive && !hasInteractiveTerminal()) {
    return initialState;
  }

  if (parsedArgs.interactive && !hasInteractiveTerminal()) {
    throw new Error('Interactive mode requires a TTY.');
  }

  return promptForScaffoldConfig(initialState);
}

function buildScaffoldConfig(
  parsedArgs: ParsedArgs,
  projectName: string,
  targetDir: string,
  installableFeatureIds: string[],
  manifest?: ScaffoldConfig['manifest'],
  selectedFeatureIdsOverride?: string[],
): ScaffoldConfig {
  const packageSlug = manifest?.packageSlug ?? toPackageSlug(projectName);
  const pythonModuleName = manifest?.pythonModuleName ?? toPythonModuleName(packageSlug);
  const selectedFeatureIds =
    selectedFeatureIdsOverride ??
    (parsedArgs.command === 'add' && manifest
      ? resolveEnabledFeatureIds([
          ...getEnabledFeatureIdsFromManifest(manifest),
          ...installableFeatureIds,
        ])
      : resolveFeatureIdsForPreset('default', installableFeatureIds));

  return scaffoldConfigSchema.parse({
    ...parsedArgs,
    manifest,
    manifestPath: path.join(targetDir, '.axi', 'scaffold.manifest.json'),
    mode: resolveMode(parsedArgs),
    installableFeatureIds,
    packageSlug,
    presetId: 'default',
    projectName,
    pythonModuleName,
    scope: `@${packageSlug}`,
    selectedFeatureIds,
    targetDir,
    tokensPackageName: `@${packageSlug}/tokens`,
    verify: parsedArgs.install ? parsedArgs.verify : false,
    webPackageName: `@${packageSlug}/web`,
  });
}

export async function resolveScaffoldConfig(parsedArgs: ParsedArgs): Promise<ScaffoldConfig> {
  if (parsedArgs.command === 'add') {
    const modulesConfig = await readScaffoldModulesConfig(parsedArgs.cwd);
    const manifest = await readScaffoldManifest(parsedArgs.cwd);
    const currentEnabledFeatureIds = modulesConfig
      ? getEnabledFeatureIdsFromModulesConfig(modulesConfig)
      : getEnabledFeatureIdsFromManifest(manifest);
    const nextInstallableFeatureIds = validateInstallableFeatureIds([
      ...currentEnabledFeatureIds.filter((featureId) =>
        getInstallableFeatureDefinitions().some((feature) => feature.manifest.id === featureId),
      ),
      ...parsedArgs.featureIds,
    ]);
    const nextSelectedFeatureIds = resolveEnabledFeatureIds([
      ...currentEnabledFeatureIds,
      ...nextInstallableFeatureIds,
    ]);

    return buildScaffoldConfig(
      parsedArgs,
      manifest.projectName,
      parsedArgs.cwd,
      nextInstallableFeatureIds,
      manifest,
      nextSelectedFeatureIds,
    );
  }

  if (parsedArgs.command === 'sync') {
    const modulesConfig = await readScaffoldModulesConfig(parsedArgs.cwd);
    const manifest = await readScaffoldManifest(parsedArgs.cwd);
    const currentEnabledFeatureIds = modulesConfig
      ? getEnabledFeatureIdsFromModulesConfig(modulesConfig)
      : getEnabledFeatureIdsFromManifest(manifest);
    const selectedFeatureIds = resolveEnabledFeatureIds(currentEnabledFeatureIds);
    const installableFeatureIds = selectedFeatureIds.filter((featureId) => {
      const feature = getFeatureDefinition(featureId);
      return feature.manifest.layer !== 'foundation';
    });

    return buildScaffoldConfig(
      parsedArgs,
      manifest.projectName,
      parsedArgs.cwd,
      installableFeatureIds,
      manifest,
      selectedFeatureIds,
    );
  }

  const scaffoldArgs = parsedArgs as ParsedArgs & { command: 'init' | 'create' };
  const promptState = await resolvePromptState(scaffoldArgs);
  const projectName = normalizeProjectName(promptState.projectName);
  const installableFeatureIds = validateInstallableFeatureIds(promptState.featureIds);
  const targetDir =
    scaffoldArgs.command === 'create'
      ? path.resolve(scaffoldArgs.cwd, projectName)
      : scaffoldArgs.cwd;

  return buildScaffoldConfig(
    {
      ...scaffoldArgs,
      featureIds: installableFeatureIds,
      install: promptState.install,
      verify: promptState.install ? promptState.verify : false,
    },
    projectName,
    targetDir,
    installableFeatureIds,
  );
}
