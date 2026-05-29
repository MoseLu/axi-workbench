import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot, useProjects } from '@epap/api-client';
import type { AxiResourceView, ManagedResource, Project, ProjectStatus } from '@axi/workstation-contracts';

const statusColors: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(24, 144, 255, 0.15)', text: '#1890ff', border: 'rgba(24, 144, 255, 0.3)' },
  archived: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.45)', border: 'rgba(255, 255, 255, 0.1)' },
  draft: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.65)', border: 'rgba(255, 255, 255, 0.1)' },
  completed: { bg: 'rgba(82, 196, 26, 0.15)', text: '#52c41a', border: 'rgba(82, 196, 26, 0.3)' },
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, isLoading: snapshotLoading } = useControlSnapshot();
  const { data: projectsResponse, isLoading, error } = useProjects();

  const serviceProjects = snapshot?.axiResources?.project ?? (snapshot?.resources || []).filter((resource) => resource.layer === 'software');
  const projects: Project[] = projectsResponse?.items || [];

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${encodeURIComponent(projectId)}`);
  };

  if (snapshotLoading && isLoading) {
    return <PageMessage>Loading projects...</PageMessage>;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            Software Layer Projects
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.45)' }}>
            {serviceProjects.length || projects.length} managed project{(serviceProjects.length || projects.length) !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {serviceProjects.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {serviceProjects.map((resource) => (
            <ServiceProjectCard key={resource.id} resource={resource} onClick={handleProjectClick} />
          ))}
        </div>
      ) : error ? (
        <PageMessage>Control plane and legacy project API are not reachable.</PageMessage>
      ) : projects.length === 0 ? (
        <PageMessage>No software-layer projects discovered.</PageMessage>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {projects.map((project) => {
            const statusStyle = statusColors[project.status];
            return (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                style={cardStyle}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={cardTitleStyle}>{project.name}</h3>
                  <span style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 4,
                    background: statusStyle.bg,
                    color: statusStyle.text,
                    border: `1px solid ${statusStyle.border}`,
                    textTransform: 'capitalize',
                    marginLeft: 12,
                    flexShrink: 0,
                  }}>
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p style={descriptionStyle}>{project.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

type ServiceProjectResource = ManagedResource | AxiResourceView;

interface ServiceProjectCardProps {
  resource: ServiceProjectResource;
  onClick: (projectId: string) => void;
}

const ServiceProjectCard: React.FC<ServiceProjectCardProps> = ({ resource, onClick }) => {
  const git = resource.metadata?.git as { branch?: string; changedEntries?: number; clean?: boolean } | null | undefined;
  const consumers = resource.metadata?.consumers as string[] | undefined;
  const projectId = 'resourceId' in resource && resource.resourceId ? resource.resourceId : resource.id;

  return (
    <div onClick={() => onClick(projectId)} style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h3 style={cardTitleStyle}>{projectId}</h3>
        <span style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 4,
          background: resource.status === 'available' ? 'rgba(82,196,26,0.14)' : 'rgba(250,173,20,0.14)',
          color: resource.status === 'available' ? '#52c41a' : '#faad14',
          border: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {resource.status}
        </span>
      </div>
      <p style={descriptionStyle}>{resource.kind}</p>
      <div style={metaGridStyle}>
        <Meta label="Branch" value={git?.branch || 'n/a'} />
        <Meta label="Changes" value={String(git?.changedEntries || 0)} />
        <Meta label="Consumes" value={String(resource.consumes.length)} />
        <Meta label="Consumers" value={String(consumers?.length || 0)} />
      </div>
      {resource.provides.length > 0 && (
        <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.52)', fontSize: 12, lineHeight: 1.5 }}>
          {resource.provides.slice(0, 4).join(', ')}
        </div>
      )}
    </div>
  );
};

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    <div style={{ marginTop: 2, fontSize: 13, color: 'rgba(255,255,255,0.72)', overflowWrap: 'anywhere' }}>{value}</div>
  </div>
);

const PageMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: 48, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
    {children}
  </div>
);

const cardStyle: React.CSSProperties = {
  padding: 20,
  background: 'rgba(255, 255, 255, 0.03)',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.06)',
  cursor: 'pointer',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#fff',
  margin: 0,
  flex: 1,
  overflowWrap: 'anywhere',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(255, 255, 255, 0.55)',
  lineHeight: 1.5,
  margin: 0,
};

const metaGridStyle: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 12,
  borderTop: '1px solid rgba(255,255,255,0.06)',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 10,
};

export default Projects;
