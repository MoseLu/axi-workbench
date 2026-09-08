import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskStatsPanel from '../components/Dashboard/TaskStats';
import type { TaskStats } from '../types/task';

describe('TaskStatsPanel 组件', () => {
  const mockStats: TaskStats = {
    total: 100,
    completed: 45,
    inProgress: 20,
    todo: 30,
    blocked: 3,
    failed: 2,
    completionRate: 45,
  };

  it('应该渲染总任务数', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('总任务数')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
  });

  it('应该渲染已完成任务数', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('已完成')).toBeDefined();
    expect(screen.getByText('45')).toBeDefined();
  });

  it('应该渲染进行中任务数', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('进行中')).toBeDefined();
    expect(screen.getByText('20')).toBeDefined();
  });

  it('应该渲染待开始任务数', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('待开始')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();
  });

  it('应该渲染阻塞任务数（当有阻塞任务时）', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('已阻塞')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('应该渲染失败任务数（当有失败任务时）', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('已失败')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('应该渲染总进度', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('总进度')).toBeDefined();
    expect(screen.getByText('45%')).toBeDefined();
  });

  it('应该渲染进度详情', () => {
    render(<TaskStatsPanel stats={mockStats} />);
    expect(screen.getByText('已完成 45/100 个任务')).toBeDefined();
  });
});
