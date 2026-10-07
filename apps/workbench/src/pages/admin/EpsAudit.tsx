import React from 'react';
// axi-ui-escape-hatch: antd Button 在 @axi/widgets 暂无等价「带 loading 的 primary 触发按钮」前
// 保留；触发行为完全等价，差异只是样式 token。等 @axi/widgets.AxiButton 上线后
// 一并替换。
import { App as AntdApp, Button } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { AxiCardBanner, AxiTag } from '@axi/core';
import { AxiBanner } from '@axi/widgets';
import { useEpsAssets, useEpsFindings, useEpsRuns, useRunEpsAudit } from '@axi/api-client';
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
  const { modal } = AntdApp.useApp();
  const assets = useEpsAssets();
  const findings = useEpsFindings();
  const runs = useEpsRuns();
  const runAudit = useRunEpsAudit();
  const latest = runs.data?.items?.[0];
  const assetRows: EpsAsset[] = assets.data?.items ?? [];
  const findingRows: EpsFinding[] = findings.data?.items ?? [];
  const findingsTotal = latest?.summary.findings ?? findings.data?.total ?? 0;
  const findingsCountLabel = t('epsAudit.findings.count')
    .replace('{count}', String(findingsTotal));
  const findingsTitle = findings.isLoading
    ? t('epsAudit.findings.loading')
    : t('epsAudit.findings.title');
  const assetsTitle = assets.isLoading
    ? t('epsAudit.assets.loading')
    : t('epsAudit.assets.title');

  const findingColumns: AxiTableColumn<EpsFinding>[] = [
    {
      dataIndex: 'severity',
      title: t('epsAudit.column.severity'),
      width: 96,
      render: (value: string) => (
        <AxiTag type={severityTone(value)} effect="dark">{value}</AxiTag>
      ),
    },
    { dataIndex: 'message', title: t('epsAudit.column.message') },
    {
      dataIndex: 'refs',
      title: t('epsAudit.column.refs'),
      render: (value: string[]) => value.join(', '),
    },
  ];
  const assetColumns: AxiTableColumn<EpsAsset>[] = [
    { dataIndex: 'platform', title: t('epsAudit.column.platform'), width: 140 },
    { dataIndex: 'method', title: t('epsAudit.column.method'), width: 90 },
    { dataIndex: 'path', title: t('epsAudit.column.path') },
    {
      dataIndex: 'service',
      title: t('epsAudit.column.service'),
      width: 140,
      render: (value: string | null) => value || '—',
    },
    { dataIndex: 'source', title: t('epsAudit.column.source'), width: 160 },
  ];

  return (
    <div className="eps-audit">
      {runAudit.isError && (
        <AxiBanner
          tone="danger"
          role="alert"
          aria-live="assertive"
          message={t('epsAudit.error.startFailed')}
        />
      )}
      <AxiCardBanner
        className="eps-audit__findings"
        extra={(
          <Button
            loading={runAudit.isPending}
            type="primary"
            onClick={() => modal.confirm({
              title: t('epsAudit.runAudit'),
              content: t('epsAudit.runAuditConfirm', '将重新运行 EPS 审计扫描，覆盖当前审计运行记录，确认继续？'),
              okText: t('common.confirm', '确认'),
              cancelText: t('common.cancel', '取消'),
              okButtonProps: { danger: true },
              onOk: () => runAudit.mutate(),
            })}
          >
            {t('epsAudit.runAudit')}
          </Button>
        )}
        title={t('epsAudit.findings.title')}
      >
        <AxiTableGroup
          description={findingsCountLabel}
          title={findingsTitle}
        >
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
        title={t('epsAudit.assets.title')}
      >
        <AxiTableGroup title={assetsTitle}>
          {assetRows.length ? (
            <AxiTable
              columns={assetColumns}
              data={assetRows}
              pagination={{ pageSize: 10 }}
              rowKey="id"
              size="small"
            />
          ) : (
            <div className="eps-audit__empty" data-axi="eps-empty">
              {t('epsAudit.assets.empty')}
            </div>
          )}
        </AxiTableGroup>
      </AxiCardBanner>
    </div>
  );
};

export default EpsAudit;