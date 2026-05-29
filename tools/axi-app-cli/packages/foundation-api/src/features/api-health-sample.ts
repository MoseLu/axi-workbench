import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';
import {
  createApiTest,
  createHealthInit,
  createHealthRoutes,
  createHealthService,
} from '../templates/generated-api.js';

export const apiHealthSampleManifest = {
  category: 'samples',
  configKey: 'modules.api-health-sample.enabled',
  dependencies: ['api-core'],
  description: 'Sample health endpoint and smoke test for the default Flask scaffold.',
  enabledByDefault: true,
  id: 'api-health-sample',
  layer: 'foundation',
  title: 'API Health Sample',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyApiHealthSample(context: FeatureRenderContext): ProjectFile[] {
  return [
    {
      path: `apps/api/src/${context.pythonModuleName}/features/health/__init__.py`,
      content: createHealthInit(),
    },
    {
      path: `apps/api/src/${context.pythonModuleName}/features/health/routes.py`,
      content: createHealthRoutes(),
    },
    {
      path: `apps/api/src/${context.pythonModuleName}/features/health/service.py`,
      content: createHealthService(),
    },
    { path: 'apps/api/tests/test_health.py', content: createApiTest(context) },
  ];
}

export const apiHealthSampleFeature = defineScaffoldFeature(
  apiHealthSampleManifest,
  applyApiHealthSample,
);
