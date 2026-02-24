import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useTasks, useCreateTask } from '@epap/api-client';
import type { Task, TaskStatus, TaskPriority, ProjectStatus } from '@epap/schemas';

const taskStatusColors: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  todo: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.65)', border: 'rgba(255, 255, 255, 0.1)' },
  in_progress: { bg: 'rgba(24, 144, 255, 0.15)', text: '#1890ff', border: 'rgba(24, 144, 255, 0.3)' },
  review: { bg: 'rgba(255, 170, 0, 0.15)', text: '#faad14', border: 'rgba(255, 170, 0, 0.3)' },
  done: { bg: 'rgba(82, 196, 26, 0.15)', text: '#52c41a', border: 'rgba(82, 196, 26, 0.3)' },
  cancelled: { bg: 'rgba(255, 77, 79, 0.1)', text: '#ff4d4f', border: 'rgba(255, 77, 79, 0.2)' },
};

const priorityColors: Record<TaskPriority, string> = {
  low: 'rgba(255, 255, 255, 0.35)',
  medium: '#1890ff',
  high: '#faad14',
  urgent: '#ff4d4f',
};

const projectStatusColors: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(24, 144, 255, 0.15)', text: '#1890ff', border: 'rgba(24, 144, 255, 0.3)' },
  archived: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.45)', border: 'rgba(255, 255, 255, 0.1)' },
  draft: { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.65)', border: 'rgba(255, 255, 255, 0.1)' },
  completed: { bg: 'rgba(82, 196, 26, 0.15)', text: '#52c41a', border: 'rgba(82, 196, 26, 0.3)' },
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id!);
  const { data: tasksResponse, isLoading: tasksLoading, error: tasksError } = useTasks({ projectId: id });
  const createTask = useCreateTask();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [formError, setFormError] = useState('');

  const tasks: Task[] = tasksResponse?.items || [];

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!newTaskTitle.trim()) {
      setFormError('Task title is required');
      return;
    }

    try {
      await createTask.mutateAsync({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        status: 'todo',
        projectId: id!,
      });
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
      setShowAddForm(false);
    } catch {
      setFormError('Failed to create task');
    }
  };

  const getStatusLabel = (status: TaskStatus): string => {
    const labels: Record<TaskStatus, string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'Review',
      done: 'Done',
      cancelled: 'Cancelled',
    };
    return labels[status];
  };

  if (projectLoading) {
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
          Loading project...
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div style={{ padding: 24 }}>
        <button
          onClick={() => navigate('/projects')}
          style={{
            marginBottom: 16,
            padding: '8px 16px',
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.65)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ← Back to Projects
        </button>
        <div style={{
          padding: '16px 20px',
          background: 'rgba(255, 77, 79, 0.1)',
          border: '1px solid rgba(255, 77, 79, 0.3)',
          borderRadius: 8,
          color: '#ff4d4f',
          fontSize: 14,
        }}>
          Failed to load project. The project may not exist.
        </div>
      </div>
    );
  }

  const projectStatusStyle = projectStatusColors[project.status];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <button
        onClick={() => navigate('/projects')}
        style={{
          marginBottom: 16,
          padding: '8px 16px',
          fontSize: 13,
          color: 'rgba(255, 255, 255, 0.65)',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        ← Back to Projects
      </button>

      {/* Project Info */}
      <div style={{
        padding: 24,
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: 24,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 600, 
            color: '#fff',
            margin: 0,
          }}>
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
          <p style={{ 
            fontSize: 14, 
            color: 'rgba(255, 255, 255, 0.55)',
            lineHeight: 1.6,
            margin: 0,
            marginBottom: 16,
          }}>
            {project.description}
          </p>
        )}
        
        <div style={{ 
          display: 'flex',
          gap: 24,
          paddingTop: 12,
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.35)' }}>Created: </span>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.55)' }}>
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.35)' }}>Updated: </span>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.55)' }}>
              {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tasks Section */}
      <div style={{
        padding: 24,
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            color: '#fff',
            margin: 0,
          }}>
            Tasks ({tasks.length})
          </h2>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                background: '#1890ff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              + Add Task
            </button>
          )}
        </div>

        {/* Add Task Form */}
        {showAddForm && (
          <form onSubmit={handleAddTask} style={{
            padding: 20,
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: 20,
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: 'block',
                fontSize: 13, 
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.75)', 
                marginBottom: 8,
              }}>
                Title
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ 
                display: 'block',
                fontSize: 13, 
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.75)', 
                marginBottom: 8,
              }}>
                Description (optional)
              </label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Enter task description"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block',
                fontSize: 13, 
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.75)', 
                marginBottom: 8,
              }}>
                Priority
              </label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                style={{
                  padding: '10px 14px',
                  fontSize: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {formError && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(255, 77, 79, 0.1)',
                border: '1px solid rgba(255, 77, 79, 0.3)',
                borderRadius: 6,
                color: '#ff4d4f',
                fontSize: 13,
                marginBottom: 16,
              }}>
                {formError}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={createTask.isPending}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  background: createTask.isPending ? 'rgba(24, 144, 255, 0.6)' : '#1890ff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: createTask.isPending ? 'not-allowed' : 'pointer',
                  opacity: createTask.isPending ? 0.7 : 1,
                }}
              >
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormError('');
                  setNewTaskTitle('');
                  setNewTaskDescription('');
                  setNewTaskPriority('medium');
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.65)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Tasks List */}
        {tasksLoading ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 32,
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: 14,
          }}>
            Loading tasks...
          </div>
        ) : tasksError ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255, 77, 79, 0.1)',
            border: '1px solid rgba(255, 77, 79, 0.3)',
            borderRadius: 8,
            color: '#ff4d4f',
            fontSize: 14,
          }}>
            Failed to load tasks.
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            padding: 32,
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 14, margin: 0 }}>
              No tasks yet. Add your first task to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasks.map((task) => {
              const statusStyle = taskStatusColors[task.status];
              return (
                <div
                  key={task.id}
                  style={{
                    padding: 16,
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ 
                        fontSize: 15, 
                        fontWeight: 500, 
                        color: '#fff',
                        margin: 0,
                        marginBottom: 6,
                      }}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p style={{ 
                          fontSize: 13, 
                          color: 'rgba(255, 255, 255, 0.45)',
                          lineHeight: 1.5,
                          margin: 0,
                          marginBottom: 8,
                        }}>
                          {task.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 500,
                          borderRadius: 4,
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          border: `1px solid ${statusStyle.border}`,
                        }}>
                          {getStatusLabel(task.status)}
                        </span>
                        <span style={{
                          fontSize: 12,
                          color: priorityColors[task.priority],
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: priorityColors[task.priority],
                          }} />
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                        {task.dueDate && (
                          <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.35)' }}>
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
