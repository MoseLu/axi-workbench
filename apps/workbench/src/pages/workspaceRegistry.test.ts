import { describe, expect, it } from 'vitest';
import type { ManagedResource } from '@axi/workstation-contracts';

import { groupWorkspaceResources } from './workspaceRegistry';

function resource(id: string, layer: string): ManagedResource {
  return {
    id,
    name: id,
    layer: layer as ManagedResource['layer'],
    kind: 'test-resource',
    path: '',
    status: 'available',
    provides: [],
    consumes: [],
    contracts: [],
    commands: [],
    metadata: {},
  };
}

describe('groupWorkspaceResources', () => {
  it('keeps docs and rules visible in their control-plane layers', () => {
    const groups = groupWorkspaceResources([
      resource('axi-docs', 'base_service'),
      resource('axi-rules', 'software'),
      resource('story-graph', 'software'),
    ]);

    expect(groups.map((group) => [group.layer, group.resources.map((item) => item.id)])).toEqual([
      ['software', ['axi-rules', 'story-graph']],
      ['base_service', ['axi-docs']],
    ]);
  });
});
