export type CommandName = 'init' | 'create' | 'add' | 'sync' | 'list' | 'doctor';
export type ScaffoldCommandName = Extract<CommandName, 'init' | 'create' | 'add' | 'sync'>;
export type ExecutionMode = 'interactive' | 'default';
export type TemplateName = 'default';
export type PresetName = 'default';
export type FeatureLayer = 'foundation' | 'extension' | 'experimental';
export type FeatureCategory =
  | 'platform'
  | 'frontend'
  | 'backend'
  | 'styling'
  | 'resources'
  | 'samples'
  | 'docs';

export interface ParsedArgs {
  command: CommandName;
  cwd: string;
  featureIds: string[];
  fix: boolean;
  install: boolean;
  interactive: boolean;
  invokedName: string;
  json: boolean;
  projectName?: string;
  template: TemplateName;
  verify: boolean;
  yes: boolean;
}

export interface PromptState {
  command: Extract<CommandName, 'init' | 'create'>;
  featureIds: string[];
  install: boolean;
  projectName: string;
  targetDir: string;
  template: TemplateName;
  verify: boolean;
}

export interface ProjectFile {
  content: string;
  executable?: boolean;
  path: string;
}

export interface FeatureSummary {
  category: FeatureCategory;
  configKey: string;
  dependencies?: string[];
  description: string;
  enabledByDefault: boolean;
  id: string;
  layer: FeatureLayer;
  title: string;
  version: string;
}

export interface ThemePresetContribution {
  description: string;
  id: string;
  label: string;
  thesis: string;
}

export interface ScaffoldModuleContribution<TType extends string = string, TData = unknown> {
  data: TData;
  type: TType;
}

export interface PresetModulePolicy {
  experimental: string[];
  extension: string[];
  foundation: string[];
}

export interface PresetDefinition {
  description: string;
  id: PresetName;
  modules: PresetModulePolicy;
}

export interface ScaffoldModuleState {
  enabled: boolean;
  id: string;
  layer: FeatureLayer;
  version: string;
}

export interface ScaffoldModulesConfigEntry {
  configKey: string;
  enabled: boolean;
  layer: FeatureLayer;
  version: string;
}

export interface ScaffoldModulesConfig {
  modules: Record<string, ScaffoldModulesConfigEntry>;
  presetId: PresetName;
  version: 1;
}

export interface ScaffoldManifest {
  createdAt: string;
  managedFiles: string[];
  modules: ScaffoldModuleState[];
  packageSlug: string;
  presetId: PresetName;
  projectName: string;
  pythonModuleName: string;
  selectedFeatureIds?: string[];
  version: 2;
}

export interface ScaffoldConfig extends Omit<ParsedArgs, 'command'> {
  command: ScaffoldCommandName;
  manifest?: ScaffoldManifest;
  manifestPath: string;
  mode: ExecutionMode;
  installableFeatureIds: string[];
  packageSlug: string;
  presetId: PresetName;
  projectName: string;
  pythonModuleName: string;
  scope: string;
  selectedFeatureIds: string[];
  targetDir: string;
  tokensPackageName: string;
  webPackageName: string;
}

export interface FeatureRenderContext extends ScaffoldConfig {
  availableInstallableFeatures: FeatureSummary[];
  selectedFeatureSummaries: FeatureSummary[];
  selectedThemePresetContributions: ThemePresetContribution[];
}

export interface ScaffoldModuleManifest extends FeatureSummary {
  contributions?: ScaffoldModuleContribution[];
}

export interface ScaffoldFeatureDefinition {
  apply(context: FeatureRenderContext): ProjectFile[];
  manifest: ScaffoldModuleManifest;
}
