import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@epap/api-client';
import type { Project, ProjectStatus } from '@epap/schemas';

const statusColors: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(24, 144, 255, 0.15)', text: '#1890ff', border: 'rgba(24, 144, 255, 0.3)' },
  archived: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.45)', border: 'rgba(255, 255, 255, 0.1)' },
  draft: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.65)', border: 'rgba(255, 255, 255, 0.1)' },
  completed: { bg: 'rgba(82, 196, 26, 0.15)', text: '#52c41a', border: 'rgba(82, 196, 26, 0.3)' },
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { data: projectsResponse, isLoading, error } = useProjects();

  const projects: Project[] = projectsResponse?.items || [];

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: 200,
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: 14,
        }}>
          Loading projects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          padding: '16px 20px',
          background: 'rgba(255, 77, 79, 0.1)',
          border: '1px solid rgba(255, 77, 79, 0.3)',
          borderRadius: 8,
          color: '#ff4d4f',
          fontSize: 14,
        }}>
          Failed to load projects. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 600, 
            color: '#fff',
            marginBottom: 4,
          }}>
            Projects
          </h1>
          <p style={{ 
            fontSize: 14, 
            color: 'rgba(255, 255, 255, 0.45)',
          }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{
          padding: 48,
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 14 }}>
            No projects yet. Create your first project to get started.
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: 16,
        }}>
          {projects.map((project) => {
            const statusStyle = statusColors[project.status];
            return (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                style={{
                  padding: 20,
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <h3 style={{ 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: '#fff',
                    margin: 0,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {project.name}
                  </h3>
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
                  <p style={{ 
                    fontSize: 13, 
                    color: 'rgba(255, 255, 255, 0.55)',
                    lineHeight: 1.5,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {project.description}
                  </p>
                )}
                
                <div style={{ 
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ 
                    fontSize: 12, 
                    color: 'rgba(255, 255, 255, 0.35)',
                  }}>
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <span style={{ 
                    fontSize: 12, 
                    color: 'rgba(255, 255, 255, 0.35)',
                  }}>
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
