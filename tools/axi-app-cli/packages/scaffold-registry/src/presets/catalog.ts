import type { PresetDefinition, PresetName } from '@axi/scaffold-kit';
import { defaultPreset } from './default.js';

const presetRegistry = [defaultPreset] as const satisfies readonly PresetDefinition[];

const presetMap = new Map<PresetName, PresetDefinition>(presetRegistry.map((preset) => [preset.id, preset]));

export function getPresetDefinition(presetId: PresetName): PresetDefinition {
  const preset = presetMap.get(presetId);

  if (!preset) {
    throw new Error(`Unknown preset "${presetId}".`);
  }

  return preset;
}
