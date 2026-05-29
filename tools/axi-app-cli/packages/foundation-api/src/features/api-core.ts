import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';
import {
  createApiApp,
  createApiConfig,
  createApiFeatureInit,
  createApiInit,
  createFlaskReadme,
  createPyProject,
} from '../templates/generated-api.js';

export const apiCoreManifest = {
  category: 'backend',
  configKey: 'modules.api-core.enabled',
  dependencies: ['workspace-core'],
  description: 'Flask app factory, auto-registered feature modules, and pytest project config.',
  enabledByDefault: true,
  id: 'api-core',
  layer: 'foundation',
  title: 'API Core',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyApiCore(context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: 'apps/api/README.md', content: createFlaskReadme(context) },
    { path: 'apps/api/pyproject.toml', content: createPyProject(context) },
    { path: `apps/api/src/${context.pythonModuleName}/__init__.py`, content: createApiInit() },
    { path: `apps/api/src/${context.pythonModuleName}/config.py`, content: createApiConfig() },
    { path: `apps/api/src/${context.pythonModuleName}/app.py`, content: createApiApp() },
    {
      path: `apps/api/src/${context.pythonModuleName}/features/__init__.py`,
      content: createApiFeatureInit(),
    },
  ];
}

export const apiCoreFeature = defineScaffoldFeature(apiCoreManifest, applyApiCore);
