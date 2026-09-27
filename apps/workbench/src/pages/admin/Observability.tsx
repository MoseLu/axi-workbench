import React from 'react';
import { AxiTag as Tag } from '@axi/core';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { ControlPlaneState } from './ControlPlaneState';

type WorkspaceEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  projectId: string;
  severity: string;
  status: string;
  actorRef: string;
};

type Overview = {
  totalEvents: number;
  projects: number;
  services: number;
  warnings?: { total: number; open: number };
  chain?: { valid: boolean };
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    const error = new Error(`observability request failed with status ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json() as Promise<T>;
}

const Observability: React.FC = () => {
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [events, setEvents] = React.useState<WorkspaceEvent[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      getJson<Overview>('/api/v1/observability/overview'),
      getJson<{ events: WorkspaceEvent[] }>('/api/v1/observability/events?limit=50'),
    ]).then(([nextOverview, nextEvents]) => {
      if (cancelled) return;
      setOverview(nextOverview);
      setEvents(nextEvents.events);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [retryKey]);

  if (error) {
    const status = 'status' in error && typeof error.status === 'number' ? error.status : null;
    return (
      <ControlPlaneState
        actionLabel="重试"
        description={status === 404
          ? '可观测性查询接口当前未接入，请联系服务维护者；页面不会展示伪造数据。'
          : '可观测性查询服务暂时不可用，页面不会展示伪造数据。'}
        title="可观测性服务暂不可用"
        onAction={() => setRetryKey((value) => value + 1)}
      />
    );
  }
  if (loading || !overview) {
    return <ControlPlaneState description="正在读取事件、同步和运行时状态。" loading title="正在加载可观测性" />;
  }

  return (
    <AxiTableGroup
      description={`事件 ${overview.totalEvents} · 项目 ${overview.projects} · 服务 ${overview.services} · 未处理预警 ${overview.warnings?.open ?? 0} · ${overview.chain?.valid ? '哈希链正常' : '哈希链异常'}`}
      title="工作区可观测性"
    >
      <AxiTable<WorkspaceEvent>
        aria-label="工作区可观测性事件"
        columns={[
          { dataIndex: 'occurredAt', title: '时间', render: (value) => new Date(String(value)).toLocaleString() },
          { dataIndex: 'eventType', title: '事件' },
          { dataIndex: 'projectId', title: '项目' },
          { dataIndex: 'severity', title: '严重级别', render: (value) => <Tag color={value === 'critical' || value === 'error' ? 'red' : value === 'warning' ? 'orange' : 'blue'}>{String(value)}</Tag> },
          { dataIndex: 'status', title: '状态' },
          { dataIndex: 'actorRef', title: '操作者' },
        ] satisfies AxiTableColumn<WorkspaceEvent>[]}
        data={events}
        pagination={{ pageSize: 10 }}
        rowKey="eventId"
      />
    </AxiTableGroup>
  );
};

export default Observability;
