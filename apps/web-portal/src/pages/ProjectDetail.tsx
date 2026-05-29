import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useControlQuery, useControlSnapshot, useProject, useRunControlCommand } from '@epap/api-client';
import type { AgentTask, ManagedCommand, ManagedResource, ProjectStatus } from '@axi/workstation-contracts';

const projectStatusColors: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(24, 144, 255, 0.15)', text: '#1890ff', border: 'rgba(24, 144, 255, 0.3)' },
  archived: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.45)', border: 'rgba(255, 255, 255, 0.1)' },
  draft: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.65)', border: 'rgba(255, 255, 255, 0.1)' },
  completed: { bg: 'rgba(82, 196, 26, 0.15)', text: '#52c41a', border: 'rgba(82, 196, 26, 0.3)' },
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = decodeURIComponent(id || '');
  const navigate = useNavigate();
  const { data: snapshot } = useControlSnapshot();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const runCommand = useRunControlCommand();
  const controlQuery = useControlQuery();
  const [lastSummary, setLastSummary] = useState('');

  const resource = (snapshot?.resources || []).find((item) => item.id === projectId);
  const agentTasks = (snapshot?.agentTasks || []).filter((task) => task.targetId === projectId);

  const handleRunCommand = async (command: ManagedCommand) => {
    const run = await runCommand.mutateAsync(command.id);
    setLastSummary(run.summary);
  };

  const handleAskDependency = async () => {
    const run = await controlQuery.mutateAsync({ text: `解释 ${projectId} 依赖谁`, dryRun: true });
    setLastSummary(run.summary);
  };

  if (resource) {
    return (
      <ServiceResourceDetail
        resource={resource}
        onBack={() => navigate('/projects')}
        onRunCommand={handleRunCommand}
        onAskDependency={handleAskDependency}
        lastSummary={lastSummary}
        agentTasks={agentTasks}
      />
    );
  }

  if (projectLoading) {
    return <PageMessage>Loading project...</PageMessage>;
  }

  if (projectError || !project) {
    return (
      <div style={{ padding: 24 }}>
        <BackButton onClick={() => navigate('/projects')} />
        <PageMessage>Failed to load project. The project may not exist.</PageMessage>
      </div>
    );
  }

  const projectStatusStyle = projectStatusColors[project.status];

  return (
    <div style={{ padding: 24 }}>
      <BackButton onClick={() => navigate('/projects')} />
      <section style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', margin: 0 }}>
            {project.name}
          </h1>
          <span style={{
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 4,
            background: projectStatusStyle.bg,
            color: projectStatusStyle.text,
            border: `1px solid ${projectStatusStyle.border}`,
            textTransform: 'capitalize',
          }}>
            {project.status}
          </span>
        </div>
        {project.description && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
            {project.description}
          </p>
        )}
      </section>
    </div>
  );
};

interface ServiceResourceDetailProps {
  resource: ManagedResource;
  onBack: () => void;
  onRunCommand: (command: ManagedCommand) => void;
  onAskDependency: () => void;
  lastSummary: string;
  agentTasks: AgentTask[];
}

const ServiceResourceDetail: React.FC<ServiceResourceDetailProps> = ({
  resource,
  onBack,
  onRunCommand,
  onAskDependency,
  lastSummary,
  agentTasks,
}) => {
  const git = resource.metadata?.git as { branch?: string; changedEntries?: number; clean?: boolean } | null | undefined;
  const consumers = resource.metadata?.consumers as string[] | undefined;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton onClick={onBack} />
      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#fff' }}>{resource.id}</h1>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.52)', fontSize: 13 }}>
              {resource.kind} · {resource.layer}
            </p>
          </div>
          <span style={{ color: resource.status === 'available' ? '#52c41a' : '#faad14', fontSize: 13 }}>
            {resource.status}
          </span>
        </div>
        <div style={metaGridStyle}>
          <Meta label="Path" value={resource.path || 'n/a'} />
          <Meta label="Branch" value={git?.branch || 'n/a'} />
          <Meta label="Changes" value={String(git?.changedEntries || 0)} />
          <Meta label="Consumers" value={(consumers || []).join(', ') || 'none'} />
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Contracts and Capabilities</h2>
        <InfoList title="Provides" items={resource.provides} />
        <InfoList title="Consumes" items={resource.consumes} />
        <InfoList title="Contracts" items={resource.contracts} />
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Managed Commands</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {resource.commands.map((command) => (
            <button key={command.id} onClick={() => onRunCommand(command)} style={buttonStyle}>
              {command.intent === 'run_health' ? 'Run health' : 'Run verify'}
            </button>
          ))}
          <button onClick={onAskDependency} style={buttonStyle}>
            Explain dependencies
          </button>
          {resource.commands.length === 0 && (
            <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>No registered health or verify command.</span>
          )}
        </div>
        {lastSummary && (
          <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
            {lastSummary}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Recent Agent Tasks</h2>
        {agentTasks.length ? agentTasks.slice(0, 5).map((task) => (
          <div key={task.id} style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
            <div style={{ color: '#fff', fontSize: 13 }}>{task.runtime} · {task.status}</div>
            <div style={{ marginTop: 5, color: 'rgba(255,255,255,0.52)', fontSize: 12, overflowWrap: 'anywhere' }}>
              {task.summary || task.prompt}
            </div>
          </div>
        )) : (
          <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>No agent task has targeted this project yet.</span>
        )}
      </section>
    </div>
  );
};

const InfoList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div style={{ marginTop: 12 }}>
    <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, marginBottom: 6 }}>{title}</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.length > 0 ? items.map((item) => (
        <span key={item} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: 'rgba(255,255,255,0.68)', fontSize: 12 }}>
          {item}
        </span>
      )) : (
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>none</span>
      )}
    </div>
  </div>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    <div style={{ marginTop: 3, fontSize: 13, color: 'rgba(255,255,255,0.72)', overflowWrap: 'anywhere' }}>{value}</div>
  </div>
);

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: 13, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer' }}>
    Back to Projects
  </button>
);

const PageMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: 24 }}>
    <div style={{ padding: 48, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
      {children}
    </div>
  </div>
);

const panelStyle: React.CSSProperties = {
  padding: 22,
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
};

const metaGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#fff',
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 11px',
  color: '#dbe4ff',
  background: 'rgba(65,101,215,0.12)',
  border: '1px solid rgba(65,101,215,0.45)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
};

export default ProjectDetail;
