import type { AgentTask, AxiResourceView, ManagedResource } from '@axi/workstation-contracts';

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

/** A software-layer resource rendered by the Web project's catalog. */
export type ProjectResource = ManagedResource | AxiResourceView;

export type ProjectGitStatus = {
  branch?: string;
  changedEntries: number;
  clean?: boolean;
};

export type AgentTaskSummary = {
  total: number;
  active: number;
  running: number;
  awaitingApproval: number;
  completed: number;
  needsAttention: number;
};

export type ProjectCollaborationLink = {
  project: ProjectResource;
  consumers: string[];
};

const taskStatusLabels: Record<string, string> = {
  queued: '等待执行',
  running: '执行中',
  awaiting_approval: '等待审批',
  succeeded: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
};

const runtimePresentation: Record<string, { label: string; summary: string }> = {
  codex_cli: {
    label: '命令行执行器',
    summary: '用于受管任务的命令行运行环境。',
  },
  codex_app: {
    label: '桌面应用执行器',
    summary: '用于本地桌面会话的运行环境；不可用时会使用命令行执行器。',
  },
  axi_agent: {
    label: 'Axi Agent 服务',
    summary: '受限的 Agent 服务运行环境。',
  },
};

const approvalRiskLabels: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '高风险',
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

/**
 * The control plane publishes a project-specific projection in `axiResources`.
 * Fall back to the software layer only for older control-plane snapshots, so
 * the Web UI stays live without depending on the retiring legacy project API.
 */
export function getProjectResources(
  resources: ManagedResource[],
  axiProjects?: AxiResourceView[],
): ProjectResource[] {
  const source = axiProjects && axiProjects.length > 0
    ? axiProjects
    : resources.filter((resource) => resource.layer === 'software');
  const unique = new Map<string, ProjectResource>();

  source.forEach((resource) => {
    unique.set(getProjectResourceId(resource), resource);
  });

  return [...unique.values()].sort((left, right) =>
    getProjectResourceLabel(left).localeCompare(getProjectResourceLabel(right), 'zh-CN'),
  );
}

export function getProjectResourceId(resource: ProjectResource): string {
  return 'resourceId' in resource && resource.resourceId ? resource.resourceId : resource.id;
}

export function getProjectResourceLabel(resource: ProjectResource): string {
  return 'label' in resource && resource.label ? resource.label : resource.name;
}

export function getProjectResourceSummary(resource: ProjectResource): string {
  if ('summary' in resource && resource.summary) return resource.summary;
  return `${resource.kind} · ${resource.layer ?? 'software'}`;
}

export function getProjectGitStatus(resource: ProjectResource): ProjectGitStatus {
  const metadata = asRecord(resource.metadata);
  const git = asRecord(metadata?.git);
  const changedEntries = typeof git?.changedEntries === 'number' && Number.isFinite(git.changedEntries)
    ? Math.max(0, git.changedEntries)
    : 0;

  return {
    branch: typeof git?.branch === 'string' && git.branch.trim() ? git.branch : undefined,
    changedEntries,
    clean: typeof git?.clean === 'boolean' ? git.clean : undefined,
  };
}

export function getProjectConsumers(resource: ProjectResource): string[] {
  const metadata = asRecord(resource.metadata);
  const consumers = metadata?.consumers;
  return Array.isArray(consumers) ? consumers.filter((value): value is string => typeof value === 'string') : [];
}

export function projectNeedsAttention(resource: ProjectResource): boolean {
  const git = getProjectGitStatus(resource);
  return (resource.status !== undefined && resource.status !== 'available') || git.changedEntries > 0 || git.clean === false;
}

export function projectSearchText(resource: ProjectResource): string {
  return [
    getProjectResourceId(resource),
    getProjectResourceLabel(resource),
    resource.name,
    resource.kind,
    resource.path,
    ...resource.provides,
    ...resource.consumes,
    ...resource.contracts,
  ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');
}

/** Translate control-plane enums before presenting them in the workbench. */
export function getTaskStatusLabel(status: string | undefined): string {
  return taskStatusLabels[status ?? ''] || '状态待确认';
}

/** Avoid exposing implementation ids such as `codex_cli` as UI labels. */
export function getRuntimePresentation(kind: string, fallbackSummary?: string): { label: string; summary: string } {
  return runtimePresentation[kind] || {
    label: '已登记运行环境',
    summary: fallbackSummary || '控制面已登记该运行环境。',
  };
}

/** Keep approval state readable without turning raw enum values into UI labels. */
export function getApprovalRiskLabel(riskLevel: string | undefined): string {
  return approvalRiskLabels[riskLevel?.toLocaleLowerCase('en-US') ?? ''] || '需要确认';
}

export function getProjectConsumerSummary(consumerCount: number): string {
  return consumerCount > 0 ? `被 ${consumerCount} 个项目使用` : '暂无关联项目';
}

/**
 * Keep the dashboard and workspace views consistent about which task states
 * are still active.  The control plane remains the source of truth; this
 * helper only derives display counts from its snapshot.
 */
export function summarizeAgentTasks(tasks: Array<Pick<AgentTask, 'status'>>): AgentTaskSummary {
  const summary: AgentTaskSummary = {
    total: tasks.length,
    active: 0,
    running: 0,
    awaitingApproval: 0,
    completed: 0,
    needsAttention: 0,
  };

  tasks.forEach((task) => {
    if (task.status === 'running') summary.running += 1;
    if (task.status === 'awaiting_approval') {
      summary.awaitingApproval += 1;
      summary.needsAttention += 1;
    }
    if (task.status === 'failed') summary.needsAttention += 1;
    if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled') {
      summary.completed += 1;
    } else {
      summary.active += 1;
    }
  });

  return summary;
}

/** List only declared consumer relationships, never inferred team members. */
export function getProjectCollaborationLinks(projects: ProjectResource[]): ProjectCollaborationLink[] {
  return projects
    .map((project) => ({
      project,
      consumers: [...new Set(getProjectConsumers(project))].sort((left, right) => left.localeCompare(right, 'en')),
    }))
    .filter((link) => link.consumers.length > 0)
    .sort((left, right) => {
      const countDiff = right.consumers.length - left.consumers.length;
      return countDiff || getProjectResourceLabel(left.project).localeCompare(getProjectResourceLabel(right.project), 'zh-CN');
    });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
