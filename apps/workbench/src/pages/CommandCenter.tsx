import React, { useMemo, useState } from 'react';
// axi-ui-escape-hatch: antd Input + Button drive the command-bar search row
// because @axi/widgets.AxiSearchInput is not shipped yet. The wrapping
// AxiRow + AxiTag/AxiCardBanner cluster stays consistent with the rest of
// the desktop admin shell; swap the antd primitives once AxiSearchInput
// lands.
import { Button, Input } from 'antd';
import { useCancelAgentTask, useControlQuery, useControlSnapshot, useDecideApproval, useRunControlCommand } from '@axi/api-client';
import { AxiBasicBanner, AxiCardBanner, AxiPage, AxiTag } from '@axi/core';
import { AxiBanner, AxiRow } from '@axi/widgets';
import type { AgentTask, ApprovalRequest, ControlRun, LayerKind, ManagedResource, RouteBinding } from '@axi/workstation-contracts';
import { useI18n } from '../i18n';

const layerOrder: LayerKind[] = [
  'im',
  'communication',
  'software',
  'base_service',
  'physical_service',
  'external_capability',
];

const layerCopyKey: Record<LayerKind, string> = {
  im: 'commandCenter.layer.im',
  communication: 'commandCenter.layer.communication',
  software: 'commandCenter.layer.software',
  base_service: 'commandCenter.layer.baseService',
  physical_service: 'commandCenter.layer.physicalService',
  external_capability: 'commandCenter.layer.externalCapability',
};

const CommandCenter: React.FC = () => {
  const { t } = useI18n();
  const { data: snapshot, isLoading, error } = useControlSnapshot();
  const controlQuery = useControlQuery();
  const runCommand = useRunControlCommand();
  const cancelAgentTask = useCancelAgentTask();
  const decideApproval = useDecideApproval();
  const [query, setQuery] = useState(() => t('commandCenter.defaultQuery', '查看所有项目状态'));
  const [lastRun, setLastRun] = useState<ControlRun | null>(null);

  const resourcesByLayer = useMemo(() => {
    const grouped = new Map<LayerKind, ManagedResource[]>();
    for (const layer of layerOrder) grouped.set(layer, []);
    for (const resource of snapshot?.resources || []) {
      grouped.get(resource.layer)?.push(resource);
    }
    return grouped;
  }, [snapshot]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    const run = await controlQuery.mutateAsync({ text, channel: 'feishu' });
    setLastRun(run);
  };

  const handleRunCommand = async (commandId: string) => {
    const run = await runCommand.mutateAsync(commandId);
    setLastRun(run);
  };

  const snapshotMeta = snapshot
    ? t('commandCenter.snapshotUpdated').replace('{value}', new Date(snapshot.generatedAt).toLocaleString())
    : t('commandCenter.snapshotUnavailable');

  return (
    <AxiPage responsive>
      <AxiBasicBanner
        actions={<span>{snapshotMeta}</span>}
        description={t('commandCenter.description')}
        title={t('commandCenter.title')}
      />

      <form onSubmit={handleSubmit}>
        <AxiRow className="wb-crud-search-cluster" style={{ width: '100%' }}>
          <Input
            allowClear
            aria-label={t('commandCenter.search.ariaLabel')}
            className="cc-search-input"
            placeholder={t('commandCenter.search.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button htmlType="submit" loading={controlQuery.isPending} type="primary">
            {controlQuery.isPending ? t('commandCenter.search.running') : t('commandCenter.search.submit')}
          </Button>
        </AxiRow>
      </form>

      {lastRun && (
        <AxiCardBanner
          actions={
            <AxiTag type={lastRun.accepted ? 'success' : 'danger'} effect="dark">
              {lastRun.accepted ? t('commandCenter.lastRun.accepted') : t('commandCenter.lastRun.blocked')}
            </AxiTag>
          }
          title={lastRun.intent}
        >
          <p>{lastRun.summary}</p>
          {lastRun.actions.map((action, index) => (
            <pre key={`${action.commandId || 'action'}-${index}`}>
              {[action.summary, action.stdout, action.stderr].filter(Boolean).join('\n')}
            </pre>
          ))}
        </AxiCardBanner>
      )}

      {isLoading && (
        <AxiBanner tone="info" message={t('commandCenter.loading')} />
      )}
      {error && (
        <AxiBanner tone="danger" role="alert" aria-live="assertive" message={t('commandCenter.error.description')} />
      )}

      {snapshot && (
        <AxiRow style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <RuntimePanel runtimes={snapshot.runtimes || []} />
          <RoutesPanel routes={snapshot.routes || []} />
          <ApprovalsPanel
            approvals={snapshot.approvals || []}
            onDecision={(id, decision) => decideApproval.mutate({ id, decision })}
          />
          <AgentTasksPanel
            tasks={snapshot.agentTasks || []}
            onCancel={(id) => cancelAgentTask.mutate(id)}
          />
        </AxiRow>
      )}

      <AxiRow style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {layerOrder.map((layer) => {
          const resources = resourcesByLayer.get(layer) || [];
          return (
            <AxiCardBanner
              key={layer}
              actions={<AxiTag type="info">{resources.length}</AxiTag>}
              title={t(layerCopyKey[layer])}
            >
              {resources.length === 0 ? (
                <span>{t('commandCenter.resources.empty')}</span>
              ) : (
                <AxiRow style={{ flexDirection: 'column', gap: 10 }}>
                  {resources.map((resource) => (
                    <ResourceRow key={resource.id} resource={resource} onRunCommand={handleRunCommand} />
                  ))}
                </AxiRow>
              )}
            </AxiCardBanner>
          );
        })}
      </AxiRow>
    </AxiPage>
  );
};

interface RuntimeSession {
  available: boolean;
  fallbackKind?: string;
  kind: string;
  summary?: string;
}

const RuntimePanel: React.FC<{ runtimes: RuntimeSession[] }> = ({ runtimes }) => {
  const { t } = useI18n();
  return (
    <AxiCardBanner
      actions={<AxiTag type="info">{runtimes.length}</AxiTag>}
      title={t('commandCenter.runtime.title')}
    >
      {runtimes.map((runtime) => (
        <AxiRow key={runtime.kind} className="cc-runtime-row" style={{ flexDirection: 'column', gap: 4 }}>
          <strong>{runtime.kind}</strong>
          <AxiTag type={runtime.available ? 'success' : 'warning'} effect="dark">
            {runtime.available
              ? t('commandCenter.runtime.available')
              : t('commandCenter.runtime.fallback').replace('{value}', runtime.fallbackKind || '').trim()}
          </AxiTag>
          <span>{runtime.summary || t('commandCenter.runtime.summaryUnavailable')}</span>
        </AxiRow>
      ))}
    </AxiCardBanner>
  );
};

const RoutesPanel: React.FC<{ routes: RouteBinding[] }> = ({ routes }) => {
  const { t } = useI18n();
  return (
    <AxiCardBanner
      actions={<AxiTag type="info">{routes.length}</AxiTag>}
      title={t('commandCenter.routes.title')}
    >
      {routes.length ? routes.slice(0, 5).map((route) => (
        <AxiRow key={route.id} className="cc-route-row" style={{ flexDirection: 'column', gap: 4 }}>
          <strong>{route.channel}</strong>
          <span>{route.profile} · {route.runtimePreference || t('commandCenter.routes.profileDefault')}</span>
          <span>{route.routeKey}</span>
        </AxiRow>
      )) : <span>{t('commandCenter.routes.empty')}</span>}
    </AxiCardBanner>
  );
};

const ApprovalsPanel: React.FC<{ approvals: ApprovalRequest[]; onDecision: (id: string, decision: 'approved' | 'rejected') => void }> = ({ approvals, onDecision }) => {
  const { t } = useI18n();
  return (
    <AxiCardBanner
      actions={<AxiTag type="info">{approvals.length}</AxiTag>}
      title={t('commandCenter.approvals.title')}
    >
      {approvals.length ? approvals.slice(0, 5).map((approval) => (
        <AxiRow key={approval.id} className="cc-approval-row" style={{ flexDirection: 'column', gap: 6 }}>
          <strong>{approval.riskLevel} · {approval.status}</strong>
          <span>{approval.actionSummary}</span>
          {approval.status === 'pending' && (
            <AxiRow style={{ gap: 8 }}>
              <Button onClick={() => onDecision(approval.id, 'approved')} size="small" type="primary">
                {t('commandCenter.approvals.approve')}
              </Button>
              <Button danger onClick={() => onDecision(approval.id, 'rejected')} size="small">
                {t('commandCenter.approvals.reject')}
              </Button>
            </AxiRow>
          )}
        </AxiRow>
      )) : <span>{t('commandCenter.approvals.empty')}</span>}
    </AxiCardBanner>
  );
};

const AgentTasksPanel: React.FC<{ tasks: AgentTask[]; onCancel: (id: string) => void }> = ({ tasks, onCancel }) => {
  const { t } = useI18n();
  return (
    <AxiCardBanner
      actions={<AxiTag type="info">{tasks.length}</AxiTag>}
      title={t('commandCenter.agentTasks.title')}
    >
      {tasks.length ? tasks.slice(0, 5).map((task) => (
        <AxiRow key={task.id} className="cc-task-row" style={{ flexDirection: 'column', gap: 6 }}>
          <strong>{task.runtime} · {task.status}</strong>
          <span>{task.targetId || t('commandCenter.agentTasks.targetFallback')} · {task.summary || task.prompt}</span>
          {!['succeeded', 'failed', 'cancelled'].includes(task.status) && (
            <Button danger onClick={() => onCancel(task.id)} size="small">
              {t('commandCenter.agentTasks.cancel')}
            </Button>
          )}
        </AxiRow>
      )) : <span>{t('commandCenter.agentTasks.empty')}</span>}
    </AxiCardBanner>
  );
};

interface ResourceRowProps {
  resource: ManagedResource;
  onRunCommand: (commandId: string) => void;
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, onRunCommand }) => {
  const { t } = useI18n();
  const git = resource.metadata?.git as { branch?: string; changedEntries?: number } | null | undefined;

  return (
    <AxiRow className="cc-resource-row" style={{ flexDirection: 'column', gap: 6 }}>
      <AxiRow style={{ justifyContent: 'space-between', gap: 10 }}>
        <strong>{resource.id}</strong>
        <AxiTag type={resource.status === 'available' ? 'success' : 'warning'} effect="dark">
          {resource.status}
        </AxiTag>
      </AxiRow>
      <span>
        {resource.kind}
        {git ? ` · ${git.branch || 'git'} · ${git.changedEntries || 0} changes` : ''}
      </span>
      {resource.provides.length > 0 && (
        <span>{resource.provides.slice(0, 3).join(', ')}</span>
      )}
      {resource.commands.length > 0 && (
        <AxiRow style={{ gap: 8, flexWrap: 'wrap' }}>
          {resource.commands.slice(0, 2).map((command) => (
            <Button
              key={command.id}
              onClick={() => onRunCommand(command.id)}
              size="small"
            >
              {command.intent === 'run_health' ? t('commandCenter.command.health') : t('commandCenter.command.verify')}
            </Button>
          ))}
        </AxiRow>
      )}
    </AxiRow>
  );
};

export default CommandCenter;