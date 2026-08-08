import type { ManagedResource } from '@axi/workstation-contracts';

const layerDefinitions = [
  { layer: 'software', label: 'Projects', description: 'Registered product and software owners.' },
  { layer: 'base_service', label: 'Foundation Services', description: 'Shared docs, identity, notification, and platform capabilities.' },
  { layer: 'communication', label: 'Communication', description: 'Message and transport boundaries.' },
  { layer: 'im', label: 'Interaction Surfaces', description: 'User-facing communication and companion entry points.' },
  { layer: 'physical_service', label: 'Physical Services', description: 'Machine and fleet resources.' },
  { layer: 'external_capability', label: 'External Capabilities', description: 'Registered external providers.' },
] as const;

export type WorkspaceResourceGroup = {
  layer: string;
  label: string;
  description: string;
  resources: ManagedResource[];
};

export function groupWorkspaceResources(resources: ManagedResource[]): WorkspaceResourceGroup[] {
  const knownLayers = new Set<string>(layerDefinitions.map((item) => item.layer));
  const groups: WorkspaceResourceGroup[] = layerDefinitions.map((definition) => ({
    ...definition,
    resources: resources
      .filter((resource) => resource.layer === definition.layer)
      .sort((left, right) => left.id.localeCompare(right.id, 'en')),
  })).filter((group) => group.resources.length > 0);

  const otherResources = resources
    .filter((resource) => !knownLayers.has(resource.layer))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));

  if (otherResources.length > 0) {
    groups.push({
      layer: 'other',
      label: 'Other Resources',
      description: 'Registered resources outside the standard control-plane layers.',
      resources: otherResources,
    });
  }

  return groups;
}
