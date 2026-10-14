/**
 * Commit Ledger — commit timeline column definitions.
 *
 * Moved verbatim out of `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). The column array is rebuilt on every render exactly
 * as before (it was an unmemoized local in the original component body), so
 * behavior is unchanged.
 */

// axi-ui-escape-hatch: antd Tooltip 暂时保留 — @axi/ui 暂无 AxiTooltip 等价
// primitive，沿用原 CommitLedgerPage.tsx 的实现。
import { Tooltip } from 'antd';
import { AxiTag } from '@axi/core';
import { AxiRow } from '@axi/widgets';
import type { AxiTableColumn } from '@axi/crud';
import { useI18n } from '../../../../i18n';
import { STATUS_CONFIG, TYPE_COLORS } from '../constants';
import { formatRelativeTime, formatTime } from '../utils';
import type { CommitRow } from '../types';

/**
 * Builds the commit timeline columns.
 *
 * `onOpenRecord` is the drawer opener previously inlined as
 * `setSelectedRecordId(...) + setDrawerOpen(true)` inside the SHA cell.
 */
export function useCommitColumns(onOpenRecord: (recordId: string) => void): AxiTableColumn<CommitRow>[] {
  const { t } = useI18n();

  return [
    {
      dataIndex: 'committedAt',
      title: t('commitLedger.column.time') || '时间',
      width: 150,
      render: (value) => (
        <Tooltip title={formatTime(value)}>
          <span style={{ fontSize: 12 }}>{formatRelativeTime(value)}</span>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'projectId',
      title: t('commitLedger.column.project') || '项目',
      width: 150,
      render: (value) => <AxiTag color="blue">{value}</AxiTag>,
    },
    {
      dataIndex: 'shortSha',
      title: 'SHA',
      width: 90,
      render: (value, row) => (
        <Tooltip title={row.sha}>
          <code
            style={{ cursor: 'pointer', fontSize: 12 }}
            onClick={() => {
              onOpenRecord(row.recordId);
            }}
          >
            {value}
          </code>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'type',
      title: t('commitLedger.column.type') || '类型',
      width: 100,
      render: (value, row) => (
        <AxiRow>
          <AxiTag color={TYPE_COLORS[value] || 'default'}>{value}</AxiTag>
          {row.breaking && <AxiTag color="red" style={{ fontSize: 10 }}>!</AxiTag>}
        </AxiRow>
      ),
    },
    {
      dataIndex: 'subject',
      title: t('commitLedger.column.subject') || 'Subject',
      ellipsis: true,
      render: (value) => (
        <Tooltip title={value}>
          <span>{value}</span>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'authorName',
      title: t('commitLedger.column.author') || '作者',
      width: 120,
    },
    {
      dataIndex: 'verificationStatus',
      title: t('commitLedger.column.verified') || '验证',
      width: 100,
      render: (value) => {
        const config = STATUS_CONFIG[value] || STATUS_CONFIG.unknown;
        return (
          <AxiTag color={config.color} icon={config.icon}>
            {config.label}
          </AxiTag>
        );
      },
    },
    {
      dataIndex: 'isDirty',
      title: t('commitLedger.column.dirty') || 'Dirty',
      width: 80,
      render: (value) => {
        if (value === null) return <AxiTag>—</AxiTag>;
        return value ? (
          <AxiTag color="red">Dirty</AxiTag>
        ) : (
          <AxiTag color="green">Clean</AxiTag>
        );
      },
    },
    {
      dataIndex: 'evidenceCount',
      title: t('commitLedger.column.evidence') || '证据',
      width: 70,
      render: (value) => (
        <span style={{ color: value > 0 ? 'var(--color-chart-2)' : 'var(--palette-gray-500)' }}>
          {value > 0 ? `${value}` : '—'}
        </span>
      ),
    },
  ];
}
