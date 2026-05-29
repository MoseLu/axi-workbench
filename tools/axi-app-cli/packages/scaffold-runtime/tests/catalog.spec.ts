import { describe, expect, it } from 'vitest';

import {
  getExperimentalFeatureDefinitions,
  getThemePresetContributions,
  resolveFeatureIdsForPreset,
  validateInstallableFeatureIds,
} from '@axi/scaffold-registry';

describe('feature catalog', () => {
  it('uses preset policy to resolve the default enabled module set', () => {
    const featureIds = resolveFeatureIdsForPreset('default', []);

    expect(featureIds).toContain('workspace-core');
    expect(featureIds).toContain('theme-preset');
    expect(featureIds).toContain('theme-style-minimal');
    expect(featureIds).not.toContain('ui-components');
    expect(featureIds).not.toContain('hooks-pack');
  });

  it('does not inject theme style modules as a special fallback', () => {
    expect(validateInstallableFeatureIds(['theme-preset'])).toEqual(['theme-preset']);
  });

  it('reads theme preset metadata through generic module contributions', () => {
    const contributions = getThemePresetContributions(['theme-style-minimal', 'theme-style-cyberpunk']);

    expect(contributions.map((entry) => entry.id)).toEqual(['minimal', 'cyberpunk']);
  });

  it('exposes experimental modules as installable layer entries without enabling them by default', () => {
    const experimentalModuleIds = getExperimentalFeatureDefinitions().map(
      (feature) => feature.manifest.id,
    );
    const defaultFeatureIds = resolveFeatureIdsForPreset('default', []);

    expect(experimentalModuleIds).toContain('experimental-slot-shell');
    expect(defaultFeatureIds).not.toContain('experimental-slot-shell');
    expect(validateInstallableFeatureIds(['experimental-slot-shell'])).toEqual([
      'experimental-slot-shell',
    ]);
  });
});
