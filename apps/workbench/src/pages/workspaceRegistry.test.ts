import { describe, expect, it } from 'vitest';
import type { AxiResourceView, ManagedResource } from '@axi/workstation-contracts';

import {
  getProjectCollaborationLinks,
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResources,
  groupWorkspaceResources,
  projectNeedsAttention,
  summarizeAgentTasks,
} from './workspaceRegistry';

function resource(id: string, layer: string, metadata: Record<string, unknown> = {}): ManagedResource {
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
    metadata,
  };
}

function axiProject(id: string, resourceId: string): AxiResourceView {
  return {
    id,
    category: 'project',
    name: resourceId,
    label: resourceId,
    ownerId: 'workspace',
    resourceId,
    layer: 'software',
    kind: 'workbench-project',
    status: 'available',
    source: 'workspace.graph',
    provides: [],
    consumes: [],
    contracts: [],
    commands: [],
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

  it('prefers the control-plane project projection and preserves the project resource id', () => {
    const projects = getProjectResources(
      [resource('fallback-project', 'software')],
      [axiProject('project:axi-workbench', 'axi-workbench')],
    );

    expect(projects).toHaveLength(1);
    expect(getProjectResourceId(projects[0]!)).toBe('axi-workbench');
  });

  it('marks a dirty registered project as needing attention', () => {
    const dirty = resource('axi-workbench', 'software', {
      git: { branch: 'dev', changedEntries: 2, clean: false },
    });

    expect(getProjectGitStatus(dirty)).toEqual({ branch: 'dev', changedEntries: 2, clean: false });
    expect(projectNeedsAttention(dirty)).toBe(true);
  });

  it('summarizes active, completed, and attention-worthy control-plane tasks', () => {
    const summary = summarizeAgentTasks([
      { status: 'queued' },
      { status: 'running' },
      { status: 'awaiting_approval' },
      { status: 'succeeded' },
      { status: 'failed' },
    ]);

    expect(summary).toEqual({
      total: 5,
      active: 3,
      running: 1,
      awaitingApproval: 1,
      completed: 2,
      needsAttention: 2,
    });
  });

  it('uses only explicit project consumers for collaboration links', () => {
    const workbench = resource('axi-workbench', 'software', { consumers: ['axi-coder', 'axi-coder', 'axi-notify'] });
    const standalone = resource('story-graph', 'software');

    const links = getProjectCollaborationLinks([workbench, standalone]);

    expect(links).toHaveLength(1);
    expect(getProjectResourceId(links[0]!.project)).toBe('axi-workbench');
    expect(links[0]!.consumers).toEqual(['axi-coder', 'axi-notify']);
  });
});
