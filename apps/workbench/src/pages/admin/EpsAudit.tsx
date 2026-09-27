import React from 'react';
// axi-ui-escape-hatch: antd Button 在 @axi/ui 暂无等价「带 loading 的 primary 触发按钮」前
// 保留；触发行为完全等价，差异只是样式 token。等 @axi/widgets.AxiSearchInput 上线后
// 一并替换为 AxiButton。
import { Button } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { AxiCardBanner, AxiTag } from '@axi/core';
import { AxiBanner, AxiRow } from '@axi/widgets';
import { useEpsAssets, useEpsFindings, useEpsRuns, useRunEpsAudit } from '@axi/api-client';
import './EpsAudit.css';

type EpsFinding = {
  id: string;
  message: string;
  refs: string[];
  severity: string;
};

type EpsAsset = {
  id: string;
  method: string;
  path: string;
  platform: string;
  service: string | null;
  source: string;
};

const severityTone = (severity: string): 'danger' | 'warning' | 'info' => {
  if (severity === 'blocker') return 'danger';
  if (severity === 'high') return 'warning';
  return 'info';
};

const EpsAudit: React.FC = () => {
  const assets = useEpsAssets();
  const findings = useEpsFindings();
  const runs = useEpsRuns();
  const runAudit = useRunEpsAudit();
  const latest = runs.data?.items?.[0];
  const assetRows: EpsAsset[] = assets.data?.items ?? [];
  const findingRows: EpsFinding[] = findings.data?.items ?? [];

  const findingColumns: AxiTableColumn<EpsFinding>[] = [
    {
      dataIndex: 'severity',
      title: '级别',
      width: 96,
      render: (value: string) => (
        <AxiTag type={severityTone(value)} effect="dark">{value}</AxiTag>
      ),
    },
    { dataIndex: 'message', title: '问题' },
    {
      dataIndex: 'refs',
      title: '来源',
      render: (value: string[]) => value.join(', '),
    },
  ];
  const assetColumns: AxiTableColumn<EpsAsset>[] = [
    { dataIndex: 'platform', title: '平台', width: 140 },
    { dataIndex: 'method', title: '方法', width: 90 },
    { dataIndex: 'path', title: '路径' },
    {
      dataIndex: 'service',
      title: '服务',
      width: 140,
      render: (value: string | null) => value || '—',
    },
    { dataIndex: 'source', title: '来源', width: 160 },
  ];

  return (
    <div className="eps-audit">
      <AxiCardBanner
        className="eps-audit__header"
        description="只读核对三端调用、后端路由、OpenAPI 与容器端口。"
        title="API 资产审计"
        extra={
          <Button
            loading={runAudit.isPending}
            type="primary"
            onClick={() => runAudit.mutate()}
          >
            运行审计
          </Button>
        }
      />
      {runAudit.isError && (
        <AxiBanner
          tone="danger"
          role="alert"
          aria-live="assertive"
          message="审计启动失败，请检查控制面与 API Gateway 连接。"
        />
      )}
      <AxiRow className="eps-audit__stats">
        <AxiCardBanner className="eps-audit__stat" title="API 资产">
          <AxiTag type="primary" effect="dark">{latest?.summary.assets ?? assets.data?.total ?? 0}</AxiTag>
        </AxiCardBanner>
        <AxiCardBanner className="eps-audit__stat" title="前端调用">
          <AxiTag type="info" effect="dark">{latest?.summary.clientCalls ?? 0}</AxiTag>
        </AxiCardBanner>
        <AxiCardBanner className="eps-audit__stat" title="端口声明">
          <AxiTag type="info" effect="dark">{latest?.summary.ports ?? 0}</AxiTag>
        </AxiCardBanner>
        <AxiCardBanner className="eps-audit__stat" title="发现问题">
          <AxiTag type={findings.data?.total ? 'warning' : 'success'} effect="dark">
            {latest?.summary.findings ?? findings.data?.total ?? 0}
          </AxiTag>
        </AxiCardBanner>
      </AxiRow>
      <AxiCardBanner
        className="eps-audit__findings"
        title="差异发现"
      >
        <AxiTableGroup title={findings.isLoading ? '差异发现 (加载中)' : '差异发现'}>
          <AxiTable
            columns={findingColumns}
            data={findingRows}
            pagination={{ pageSize: 8 }}
            rowKey="id"
            size="small"
          />
        </AxiTableGroup>
      </AxiCardBanner>
      <AxiCardBanner
        className="eps-audit__assets"
        title="API 资产"
      >
        <AxiTableGroup title={assets.isLoading ? 'API 资产 (加载中)' : 'API 资产'}>
          {assetRows.length ? (
            <AxiTable
              columns={assetColumns}
              data={assetRows}
              pagination={{ pageSize: 10 }}
              rowKey="id"
              size="small"
            />
          ) : (
            <div className="eps-audit__empty" data-axi="eps-empty">暂无 API 资产</div>
          )}
        </AxiTableGroup>
      </AxiCardBanner>
    </div>
  );
};

export default EpsAudit;
