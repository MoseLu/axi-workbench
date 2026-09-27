export type WorkQueueFilter = 'all' | 'active' | 'attention' | 'completed';

export type TaskRow = {
  createdAt?: Date | string;
  id: string;
  runtime: string;
  status: string;
  statusKey: string;
  summary: string;
  targetId?: string;
  targetLabel?: string;
};

export type ApprovalRow = {
  createdAt?: Date | string;
  id: string;
  risk: string;
  summary: string;
};

export const workQueueFilters: Array<{ label: string; labelKey: string; value: WorkQueueFilter }> = [
  { label: '全部', labelKey: 'workspace.filter.all', value: 'all' },
  { label: '处理中', labelKey: 'workspace.filter.active', value: 'active' },
  { label: '需处理', labelKey: 'workspace.filter.attention', value: 'attention' },
  { label: '已结束', labelKey: 'workspace.filter.completed', value: 'completed' },
];

/** Filter only rows derived from the current Control Plane snapshot. */
export function filterTaskRows(rows: TaskRow[], filter: WorkQueueFilter, query: string): TaskRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  return rows.filter((row) => {
    const terminal = row.statusKey === 'succeeded' || row.statusKey === 'failed' || row.statusKey === 'cancelled';
    const needsAttention = row.statusKey === 'awaiting_approval' || row.statusKey === 'failed';
    if (filter === 'active' && terminal) return false;
    if (filter === 'attention' && !needsAttention) return false;
    if (filter === 'completed' && !terminal) return false;
    if (!normalizedQuery) return true;
    return [row.id, row.runtime, row.status, row.summary, row.targetId, row.targetLabel]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(normalizedQuery);
  });
}

export function filterApprovalRows(rows: ApprovalRow[], query: string): ApprovalRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  if (!normalizedQuery) return rows;
  return rows.filter((row) => [row.id, row.risk, row.summary]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(normalizedQuery));
}
