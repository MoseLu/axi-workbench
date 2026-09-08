import { describe, expect, it } from 'vitest';

import { filterApprovalRows, filterTaskRows, type ApprovalRow, type TaskRow } from './workQueue';

const tasks: TaskRow[] = [
  {
    id: 'task:queued',
    runtime: 'codex_cli',
    status: '等待执行',
    statusKey: 'queued',
    summary: '同步 Axi Workbench',
    targetId: 'axi-workbench',
    targetLabel: 'Axi Workbench',
  },
  {
    id: 'task:approval',
    runtime: 'codex_cli',
    status: '等待审批',
    statusKey: 'awaiting_approval',
    summary: '发布项目变更',
    targetId: 'axi-workbench',
    targetLabel: 'Axi Workbench',
  },
  {
    id: 'task:done',
    runtime: 'axi_agent',
    status: '已完成',
    statusKey: 'succeeded',
    summary: '生成状态快照',
  },
  {
    id: 'task:failed',
    runtime: 'axi_agent',
    status: '执行失败',
    statusKey: 'failed',
    summary: '刷新运行环境',
  },
];

const approvals: ApprovalRow[] = [
  { id: 'approval:deploy', risk: '高风险', summary: '部署到生产环境' },
  { id: 'approval:docs', risk: '低风险', summary: '更新文档' },
];

describe('工作项筛选', () => {
  it('只从控制面状态派生处理中、需处理和已完成视图', () => {
    expect(filterTaskRows(tasks, 'active', '').map((row) => row.id)).toEqual(['task:queued', 'task:approval']);
    expect(filterTaskRows(tasks, 'attention', '').map((row) => row.id)).toEqual(['task:approval', 'task:failed']);
    expect(filterTaskRows(tasks, 'completed', '').map((row) => row.id)).toEqual(['task:done', 'task:failed']);
  });

  it('在任务、关联项目和审批文本中检索，不制造本地业务记录', () => {
    expect(filterTaskRows(tasks, 'all', 'workbench').map((row) => row.id)).toEqual(['task:queued', 'task:approval']);
    expect(filterApprovalRows(approvals, '生产').map((row) => row.id)).toEqual(['approval:deploy']);
    expect(filterApprovalRows(approvals, '   ')).toBe(approvals);
  });
});
