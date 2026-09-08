import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskList from '../components/Dashboard/TaskList';
import type { Task } from '../types/task';

describe('TaskList 组件', () => {
  const mockTasks: Task[] = [
    {
      id: 'P0.1.1.001',
      title: '设计K8s集群架构方案',
      description: '设计Kubernetes集群的整体架构方案',
      status: 'completed',
      priority: 'P0',
      assignee: '张三',
      module: 'K8s集群搭建',
      category: '基础设施',
      estimatedHours: 15,
      actualHours: 12,
      progress: 100,
      testResult: 'passed',
      createdAt: '2025-02-01',
      updatedAt: '2025-02-10',
      completedAt: '2025-02-10',
    },
    {
      id: 'P1.1.1.010',
      title: 'Agent运行时服务开发',
      description: '实现单Agent运行时引擎',
      status: 'in_progress',
      priority: 'P0',
      assignee: '张三',
      module: 'Agent运行时',
      category: '核心服务',
      estimatedHours: 40,
      actualHours: 25,
      progress: 65,
      testResult: 'pending',
      createdAt: '2025-02-14',
      updatedAt: '2025-02-14',
      startedAt: '2025-02-14',
    },
    {
      id: 'P2.1.1.001',
      title: '权限服务开发',
      description: '实现RBAC权限服务',
      status: 'todo',
      priority: 'P1',
      assignee: undefined,
      module: '权限服务',
      category: '关键功能',
      estimatedHours: 20,
      testResult: 'pending',
      createdAt: '2025-02-20',
      updatedAt: '2025-02-20',
    },
    {
      id: 'P1.1.3.003',
      title: '任务调度算法实现',
      description: '实现优先级调度算法',
      status: 'blocked',
      priority: 'P1',
      assignee: '赵六',
      module: '任务调度',
      category: '核心服务',
      estimatedHours: 24,
      actualHours: 4,
      progress: 15,
      testResult: 'failed',
      createdAt: '2025-02-12',
      updatedAt: '2025-02-14',
      startedAt: '2025-02-12',
    },
  ];

  it('应该渲染任务清单标题', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('任务清单')).toBeDefined();
  });

  it('应该渲染搜索输入框', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByPlaceholderText('搜索任务...')).toBeDefined();
  });

  it('应该渲染优先级筛选下拉框', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('优先级')).toBeDefined();
  });

  it('应该渲染模块筛选下拉框', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('模块')).toBeDefined();
  });

  it('应该渲染已完成任务分组', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('已完成')).toBeDefined();
  });

  it('应该渲染进行中任务分组', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('进行中')).toBeDefined();
  });

  it('应该渲染已阻塞任务分组', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('已阻塞')).toBeDefined();
  });

  it('应该渲染待开始任务分组', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('待开始')).toBeDefined();
  });

  it('应该渲染任务项', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('设计K8s集群架构方案')).toBeDefined();
    expect(screen.getByText('Agent运行时服务开发')).toBeDefined();
  });

  it('应该渲染任务ID', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('P0.1.1.001')).toBeDefined();
  });

  it('应该渲染任务优先级标签', () => {
    render(<TaskList tasks={mockTasks} />);
    // P0 标签
    const p0Tags = screen.getAllByText('P0');
    expect(p0Tags.length).toBeGreaterThan(0);
  });

  it('应该渲染任务模块标签', () => {
    render(<TaskList tasks={mockTasks} />);
    expect(screen.getByText('K8s集群搭建')).toBeDefined();
    expect(screen.getByText('Agent运行时')).toBeDefined();
  });
});
