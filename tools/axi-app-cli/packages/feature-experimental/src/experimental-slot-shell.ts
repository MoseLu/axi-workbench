import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

function createExperimentalSlotReadme(): string {
  return `# Experimental Slot Shell

This isolated area exists to validate a new scaffold module before it graduates into
the foundation or extension layers.

## Rules

- keep experiments self-contained under \`labs/experimental-slot-shell\`
- document the hypothesis before implementation
- do not wire experimental output into core runtime paths until it proves stable
- promote the module by moving its manifest to a stable layer and updating the preset policy
`;
}

function createExperimentalSlotDoc(): string {
  return `# Experimental Slot Shell

This module is a structural placeholder for the experimental layer.

Use it when you want to test a new scaffold capability without coupling it to the
default workspace path. Experimental modules should ship behind explicit opt-in flags,
declare their dependencies, and keep their generated files isolated.
`;
}

export const experimentalSlotShellManifest = {
  category: 'resources',
  configKey: 'modules.experimental-slot-shell.enabled',
  dependencies: ['workspace-core', 'docs-core'],
  description:
    'Generic experimental sandbox module for validating future scaffold capabilities in isolation.',
  enabledByDefault: false,
  id: 'experimental-slot-shell',
  layer: 'experimental',
  title: 'Experimental Slot Shell',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyExperimentalSlotShell(_context: FeatureRenderContext): ProjectFile[] {
  return [
    {
      path: 'labs/experimental-slot-shell/README.md',
      content: createExperimentalSlotReadme(),
    },
    {
      path: 'docs/modules/experimental-slot-shell.md',
      content: createExperimentalSlotDoc(),
    },
  ];
}

export const experimentalSlotShellFeature = defineScaffoldFeature(
  experimentalSlotShellManifest,
  applyExperimentalSlotShell,
);
