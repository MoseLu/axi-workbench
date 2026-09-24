import React from 'react';
import { Alert, Button, Card, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useEpsAssets, useEpsFindings, useEpsRuns, useRunEpsAudit } from '@axi/api-client';
import './EpsAudit.css';

const EpsAudit: React.FC = () => {
  const assets = useEpsAssets();
  const findings = useEpsFindings();
  const runs = useEpsRuns();
  const runAudit = useRunEpsAudit();
  const latest = runs.data?.items?.[0];
  return <div className="eps-audit">
    <div className="eps-audit__header">
      <div><Typography.Title level={2}>API 资产审计</Typography.Title><Typography.Text type="secondary">只读核对三端调用、后端路由、OpenAPI 与容器端口。</Typography.Text></div>
      <Button type="primary" loading={runAudit.isPending} onClick={() => runAudit.mutate()}>运行审计</Button>
    </div>
    {runAudit.isError && <Alert type="error" showIcon message="审计启动失败" description="请检查控制面与 API Gateway 连接。" />}
    <Space className="eps-audit__stats" wrap>
      <Card><Statistic title="API 资产" value={latest?.summary.assets ?? assets.data?.total ?? 0} /></Card>
      <Card><Statistic title="前端调用" value={latest?.summary.clientCalls ?? 0} /></Card>
      <Card><Statistic title="端口声明" value={latest?.summary.ports ?? 0} /></Card>
      <Card><Statistic title="发现问题" value={latest?.summary.findings ?? findings.data?.total ?? 0} /></Card>
    </Space>
    <Card title="差异发现" loading={findings.isLoading}>
      <Table rowKey="id" dataSource={findings.data?.items ?? []} pagination={{ pageSize: 8 }} columns={[
        { title: '级别', dataIndex: 'severity', render: (value: string) => <Tag color={value === 'blocker' ? 'red' : value === 'high' ? 'orange' : 'blue'}>{value}</Tag> },
        { title: '问题', dataIndex: 'message' }, { title: '来源', dataIndex: 'refs', render: (value: string[]) => value.join(', ') },
      ]} />
    </Card>
    <Card title="API 资产" loading={assets.isLoading}>
      <Table rowKey="id" dataSource={assets.data?.items ?? []} pagination={{ pageSize: 10 }} columns={[
        { title: '平台', dataIndex: 'platform' }, { title: '方法', dataIndex: 'method' }, { title: '路径', dataIndex: 'path' },
        { title: '服务', dataIndex: 'service', render: (value: string | null) => value || '—' }, { title: '来源', dataIndex: 'source' },
      ]} />
    </Card>
  </div>;
};

export default EpsAudit;
