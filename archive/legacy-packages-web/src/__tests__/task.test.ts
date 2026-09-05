import { describe, it, expect } from 'vitest';
import { calculateTaskStats, groupTasksByStatus, mockTasks } from '../data/mockTasks';
import type { TaskStatus, TaskPriority } from '../types/task';

describe('任务数据计算', () => {
  it('应该正确计算任务总数', () => {
    const stats = calculateTaskStats(mockTasks);
    expect(stats.total).toBe(mockTasks.length);
  });

  it('应该正确统计已完成任务数量', () => {
    const stats = calculateTaskStats(mockTasks);
    const completedTasks = mockTasks.filter(t => t.status === 'completed');
    expect(stats.completed).toBe(completedTasks.length);
  });

  it('应该正确统计进行中任务数量', () => {
    const stats = calculateTaskStats(mockTasks);
    const inProgressTasks = mockTasks.filter(t => t.status === 'in_progress');
    expect(stats.inProgress).toBe(inProgressTasks.length);
  });

  it('应该正确统计待开始任务数量', () => {
    const stats = calculateTaskStats(mockTasks);
    const todoTasks = mockTasks.filter(t => t.status === 'todo');
    expect(stats.todo).toBe(todoTasks.length);
  });

  it('应该正确统计阻塞任务数量', () => {
    const stats = calculateTaskStats(mockTasks);
    const blockedTasks = mockTasks.filter(t => t.status === 'blocked');
    expect(stats.blocked).toBe(blockedTasks.length);
  });

  it('应该正确计算完成率', () => {
    const stats = calculateTaskStats(mockTasks);
    const expectedRate = Math.round((stats.completed / stats.total) * 100);
    expect(stats.completionRate).toBe(expectedRate);
  });

  it('空任务列表应该返回零值', () => {
    const stats = calculateTaskStats([]);
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.completionRate).toBe(0);
  });
});

describe('任务分组', () => {
  it('应该按状态正确分组任务', () => {
    const groups = groupTasksByStatus(mockTasks);

    expect(groups.completed).toBeDefined();
    expect(groups.inProgress).toBeDefined();
    expect(groups.blocked).toBeDefined();
    expect(groups.todo).toBeDefined();
  });

  it('分组后的任务总数应该等于原始任务数', () => {
    const groups = groupTasksByStatus(mockTasks);
    const totalGrouped =
      groups.completed.length +
      groups.inProgress.length +
      groups.blocked.length +
      groups.todo.length;

    expect(totalGrouped).toBe(mockTasks.length);
  });
});

describe('任务类型', () => {
  it('应该接受有效的任务状态', () => {
    const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'completed', 'blocked', 'failed'];
    validStatuses.forEach(status => {
      expect(['todo', 'in_progress', 'review', 'completed', 'blocked', 'failed']).toContain(status);
    });
  });

  it('应该接受有效的任务优先级', () => {
    const validPriorities: TaskPriority[] = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'];
    validPriorities.forEach(priority => {
      expect(['P0', 'P1', 'P2', 'P3', 'P4', 'P5']).toContain(priority);
    });
  });
});
