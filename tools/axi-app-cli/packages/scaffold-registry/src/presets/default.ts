import type { PresetDefinition } from '@axi/scaffold-kit';

export const defaultPreset: PresetDefinition = {
  description:
    'Recommended baseline preset with full foundation modules and a small set of extension modules enabled.',
  id: 'default',
  modules: {
    foundation: [
      'workspace-core',
      'docs-core',
      'tooling-core',
      'tokens-core',
      'web-core',
      'api-core',
      'api-health-sample',
    ],
    extension: [
      'theme-preset',
      'theme-style-minimal',
      'theme-style-cyberpunk',
      'theme-style-glassmorphism',
      'style-system',
    ],
    experimental: [],
  },
};
