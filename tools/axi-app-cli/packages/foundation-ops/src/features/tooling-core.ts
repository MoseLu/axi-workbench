import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import {
  createPythonUtils,
  createRunApiDev,
  createRunApiTests,
  createSetupPython,
  createVerifyApi,
} from '../templates/generated-scripts.js';
import {
  createEnvResourcesExample,
  createResourcesBatchIntake,
  createResourcesClassify,
  createResourceClassificationConfig,
  createResourceStorageConfig,
  createResourceStorageUtils,
  createResourcesBucket,
  createResourcesDelete,
  createResourcesFetch,
  createResourcesGc,
  createResourcesGet,
  createResourcesIndex,
  createResourcesIntake,
  createResourcesPut,
  createResourcesQuery,
  createResourcesReview,
  createResourcesSync,
} from '../templates/generated-resource-storage.js';
import {
  createCheckCommitRange,
  createCheckGitBranch,
  createCheckDocs,
  createCheckPrTitle,
  createCommitMsgHook,
  createInstallHooks,
  createLoadLocalEnv,
  createPreCommitHook,
  createPrePushHook,
  createSetupGitGovernance,
} from '../templates/generated-scripts.js';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

export const toolingCoreManifest = {
  category: 'platform',
  configKey: 'modules.tooling-core.enabled',
  dependencies: ['workspace-core', 'docs-core'],
  description: 'Git hooks, Python bootstrap scripts, and smoke verification commands.',
  enabledByDefault: true,
  id: 'tooling-core',
  layer: 'foundation',
  title: 'Tooling Core',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyToolingCore(context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: '.githooks/commit-msg', content: createCommitMsgHook(), executable: true },
    { path: '.githooks/pre-commit', content: createPreCommitHook(), executable: true },
    { path: '.githooks/pre-push', content: createPrePushHook(), executable: true },
    { path: 'scripts/check-commit-range.mjs', content: createCheckCommitRange() },
    { path: 'scripts/check-docs.mjs', content: createCheckDocs() },
    { path: 'scripts/check-git-branch.mjs', content: createCheckGitBranch() },
    { path: 'scripts/check-pr-title.mjs', content: createCheckPrTitle() },
    { path: 'scripts/python-utils.mjs', content: createPythonUtils() },
    { path: 'scripts/setup-python.mjs', content: createSetupPython() },
    { path: 'scripts/setup-git-governance.mjs', content: createSetupGitGovernance() },
    { path: 'scripts/run-api-tests.mjs', content: createRunApiTests() },
    { path: 'scripts/run-api-dev.mjs', content: createRunApiDev(context) },
    { path: 'scripts/verify-api.mjs', content: createVerifyApi(context) },
    { path: 'scripts/install-hooks.mjs', content: createInstallHooks() },
    { path: 'scripts/load-local-env.mjs', content: createLoadLocalEnv() },
    { path: 'scripts/resource-storage.mjs', content: createResourceStorageUtils() },
    { path: 'scripts/resources-batch-intake.mjs', content: createResourcesBatchIntake() },
    { path: 'scripts/resources-bucket.mjs', content: createResourcesBucket() },
    { path: 'scripts/resources-classify.mjs', content: createResourcesClassify() },
    { path: 'scripts/resources-delete.mjs', content: createResourcesDelete() },
    { path: 'scripts/resources-fetch.mjs', content: createResourcesFetch() },
    { path: 'scripts/resources-gc.mjs', content: createResourcesGc() },
    { path: 'scripts/resources-get.mjs', content: createResourcesGet() },
    { path: 'scripts/resources-index.mjs', content: createResourcesIndex() },
    { path: 'scripts/resources-intake.mjs', content: createResourcesIntake() },
    { path: 'scripts/resources-put.mjs', content: createResourcesPut() },
    { path: 'scripts/resources-query.mjs', content: createResourcesQuery() },
    { path: 'scripts/resources-review.mjs', content: createResourcesReview() },
    { path: 'scripts/resources-sync.mjs', content: createResourcesSync() },
    { path: 'config/resource-classification.config.json', content: createResourceClassificationConfig() },
    { path: 'config/resource-storage.config.json', content: createResourceStorageConfig(context) },
    { path: '.env.resources.example', content: createEnvResourcesExample() },
  ];
}

export const toolingCoreFeature = defineScaffoldFeature(toolingCoreManifest, applyToolingCore);
