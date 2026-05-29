import React, { useMemo, useState } from 'react';
import { useCancelAgentTask, useControlQuery, useControlSnapshot, useDecideApproval, useRunControlCommand } from '@epap/api-client';
import type { AgentTask, ApprovalRequest, ControlRun, LayerKind, ManagedResource, RouteBinding } from '@axi/workstation-contracts';

const layerLabels: Record<LayerKind, string> = {
  im: 'IM层',
  communication: '通信层',
  software: '软件层',
  base_service: '基础服务层',
  physical_service: '物理服务层',
  external_capability: '外接能力层',
};

const layerOrder: LayerKind[] = [
  'im',
  'communication',
  'software',
  'base_service',
  'physical_service',
  'external_capability',
];

const panelStyle: React.CSSProperties = {
  padding: 18,
  background: 'rgba(255, 255, 255, 0.025)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 8,
};

const compactRowStyle: React.CSSProperties = {
  padding: 10,
  marginBottom: 8,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const mutedTextStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.52)',
  fontSize: 12,
  overflowWrap: 'anywhere',
};

const smallButtonStyle: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid rgba(65,101,215,0.5)',
  borderRadius: 5,
  color: '#dbe4ff',
  background: 'rgba(65,101,215,0.12)',
  cursor: 'pointer',
  fontSize: 12,
};

const CommandCenter: React.FC = () => {
  const { data: snapshot, isLoading, error } = useControlSnapshot();
  const controlQuery = useControlQuery();
  const runCommand = useRunControlCommand();
  const cancelAgentTask = useCancelAgentTask();
  const decideApproval = useDecideApproval();
  const [query, setQuery] = useState('查看所有项目状态');
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

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, color: '#fff' }}>Command Center</h1>
          <p style={{ marginTop: 6, color: 'rgba(255,255,255,0.48)', fontSize: 13 }}>
            Natural-language control plane across IM, communication, software, base services, physical services, and external capabilities.
          </p>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>
          {snapshot ? `Updated ${new Date(snapshot.generatedAt).toLocaleString()}` : 'Snapshot unavailable'}
        </div>
      </header>

      <form onSubmit={handleSubmit} style={{ ...panelStyle, display: 'flex', gap: 10 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask: 跑一下 ielts-vocab 健康检查"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '11px 13px',
            color: '#fff',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            outline: 'none',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={controlQuery.isPending}
          style={{
            padding: '0 16px',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            background: '#4165d7',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {controlQuery.isPending ? 'Running' : 'Send'}
        </button>
      </form>

      {lastRun && (
        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <strong style={{ color: '#fff', fontSize: 15 }}>{lastRun.intent}</strong>
            <span style={{ color: lastRun.accepted ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
              {lastRun.accepted ? 'accepted' : 'blocked'}
            </span>
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>{lastRun.summary}</p>
          {lastRun.actions.map((action, index) => (
            <pre
              key={`${action.commandId || 'action'}-${index}`}
              style={{
                marginTop: 12,
                padding: 12,
                overflow: 'auto',
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(0,0,0,0.22)',
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {[action.summary, action.stdout, action.stderr].filter(Boolean).join('\n')}
            </pre>
          ))}
        </section>
      )}

      {isLoading && <div style={panelStyle}>Loading control-plane snapshot...</div>}
      {error && (
        <div style={{ ...panelStyle, color: '#ff7875' }}>
          Control plane is not reachable. Start it with `pnpm --filter @axi/workstation-control-plane dev`.
        </div>
      )}

      {snapshot && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <RuntimePanel runtimes={snapshot.runtimes || []} />
          <RoutesPanel routes={snapshot.routes || []} />
          <ApprovalsPanel approvals={snapshot.approvals || []} onDecision={(id, decision) => decideApproval.mutate({ id, decision })} />
          <AgentTasksPanel tasks={snapshot.agentTasks || []} onCancel={(id) => cancelAgentTask.mutate(id)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {layerOrder.map((layer) => {
          const resources = resourcesByLayer.get(layer) || [];
          return (
            <section key={layer} style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{layerLabels[layer]}</h2>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{resources.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {resources.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} onRunCommand={handleRunCommand} />
                ))}
                {resources.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No resources discovered.</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

const RuntimePanel: React.FC<{ runtimes: { kind: string; available: boolean; fallbackKind?: string; summary?: string }[] }> = ({ runtimes }) => (
  <section style={panelStyle}>
    <PanelHeader title="Runtime Sessions" count={runtimes.length} />
    {runtimes.map((runtime) => (
      <CompactRow key={runtime.kind}>
        <strong style={{ color: '#fff' }}>{runtime.kind}</strong>
        <span style={{ color: runtime.available ? '#52c41a' : '#faad14', fontSize: 12 }}>
          {runtime.available ? 'available' : `fallback ${runtime.fallbackKind || ''}`.trim()}
        </span>
        <span style={mutedTextStyle}>{runtime.summary || 'n/a'}</span>
      </CompactRow>
    ))}
  </section>
);

const RoutesPanel: React.FC<{ routes: RouteBinding[] }> = ({ routes }) => (
  <section style={panelStyle}>
    <PanelHeader title="Routes" count={routes.length} />
    {routes.length ? routes.slice(0, 5).map((route) => (
      <CompactRow key={route.id}>
        <strong style={{ color: '#fff' }}>{route.channel}</strong>
        <span style={mutedTextStyle}>{route.profile} · {route.runtimePreference || 'default'}</span>
        <span style={mutedTextStyle}>{route.routeKey}</span>
      </CompactRow>
    )) : <EmptyText text="No paired routes yet." />}
  </section>
);

const ApprovalsPanel: React.FC<{ approvals: ApprovalRequest[]; onDecision: (id: string, decision: 'approved' | 'rejected') => void }> = ({ approvals, onDecision }) => (
  <section style={panelStyle}>
    <PanelHeader title="Approvals" count={approvals.length} />
    {approvals.length ? approvals.slice(0, 5).map((approval) => (
      <CompactRow key={approval.id}>
        <strong style={{ color: '#fff' }}>{approval.riskLevel} · {approval.status}</strong>
        <span style={mutedTextStyle}>{approval.actionSummary}</span>
        {approval.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={smallButtonStyle} onClick={() => onDecision(approval.id, 'approved')}>OK</button>
            <button style={smallButtonStyle} onClick={() => onDecision(approval.id, 'rejected')}>NO</button>
          </div>
        )}
      </CompactRow>
    )) : <EmptyText text="No pending approvals." />}
  </section>
);

const AgentTasksPanel: React.FC<{ tasks: AgentTask[]; onCancel: (id: string) => void }> = ({ tasks, onCancel }) => (
  <section style={panelStyle}>
    <PanelHeader title="Agent Tasks" count={tasks.length} />
    {tasks.length ? tasks.slice(0, 5).map((task) => (
      <CompactRow key={task.id}>
        <strong style={{ color: '#fff' }}>{task.runtime} · {task.status}</strong>
        <span style={mutedTextStyle}>{task.targetId || 'workspace'} · {task.summary || task.prompt}</span>
        {!['succeeded', 'failed', 'cancelled'].includes(task.status) && (
          <button style={smallButtonStyle} onClick={() => onCancel(task.id)}>Cancel</button>
        )}
      </CompactRow>
    )) : <EmptyText text="No agent tasks yet." />}
  </section>
);

const PanelHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
    <h2 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{title}</h2>
    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{count}</span>
  </div>
);

const CompactRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={compactRowStyle}>{children}</div>
);

const EmptyText: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{text}</div>
);

interface ResourceRowProps {
  resource: ManagedResource;
  onRunCommand: (commandId: string) => void;
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, onRunCommand }) => {
  const git = resource.metadata?.git as { branch?: string; changedEntries?: number } | null | undefined;

  return (
    <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <strong style={{ color: '#fff', fontSize: 14, overflowWrap: 'anywhere' }}>{resource.id}</strong>
        <span style={{ color: resource.status === 'available' ? '#52c41a' : '#faad14', fontSize: 12 }}>{resource.status}</span>
      </div>
      <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.42)', fontSize: 12, overflowWrap: 'anywhere' }}>
        {resource.kind}{git ? ` · ${git.branch || 'git'} · ${git.changedEntries || 0} changes` : ''}
      </div>
      {resource.provides.length > 0 && (
        <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
          {resource.provides.slice(0, 3).join(', ')}
        </div>
      )}
      {resource.commands.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {resource.commands.slice(0, 2).map((command) => (
            <button
              key={command.id}
              onClick={() => onRunCommand(command.id)}
              style={{
                padding: '5px 8px',
                border: '1px solid rgba(65,101,215,0.5)',
                borderRadius: 5,
                color: '#dbe4ff',
                background: 'rgba(65,101,215,0.12)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {command.intent === 'run_health' ? 'health' : 'verify'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommandCenter;
