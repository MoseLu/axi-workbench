// 任务状态
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked' | 'failed';

// 任务优先级
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

// 测试结果
export type TestResult = 'passed' | 'failed' | 'pending';

// 任务
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  module: string;
  category: string;
  estimatedHours: number;
  actualHours?: number;
  progress?: number;
  testResult?: TestResult;
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// 任务统计
export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  blocked: number;
  failed: number;
  completionRate: number;
}

// 任务筛选
export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  module?: string;
  assignee?: string;
  keyword?: string;
}
