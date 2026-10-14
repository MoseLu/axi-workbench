/**
 * Commit Ledger — Project Dimension Table definitions.
 *
 * Preserved verbatim from the original `CommitLedgerPage.tsx` during the
 * 2026-10-14 architecture sweep (W4).
 *
 * NOTE: the project-dimension table is NOT part of the current render path.
 * `projectColumns` / `projectRows` were already unused locals in the original
 * 963-line page (the render only mounts the summary cards, the commit timeline
 * and the detail drawer). They are kept here — exported instead of dead locals —
 * so the split neither loses the code nor introduces unused-variable noise, and
 * so the planned project-dimension panel can be wired up without re-deriving
 * the columns. Safe to delete once the project-dimension panel is dropped from
 * the product scope.
 */

// axi-ui-escape-hatch: antd Tooltip 暂时保留 — @axi/ui 暂无 AxiTooltip 等价
// primitive，沿用原 CommitLedgerPage.tsx 的实现。
import { Tooltip } from 'antd';
import { AxiTag } from '@axi/core';
import type { AxiTableColumn } from '@axi/crud';
import { useI18n } from '../../../i18n';
import type { CommitLedgerSummary } from '../../../hooks/useCommitLedger';
import { STATUS_CONFIG } from './constants';
import type { ProjectRow } from './types';

/** Row shape returned by `useCommitLedgerProjects`. */
export type CommitLedgerProjectsData = {
  projects: Array<{ projectId: string; commitCount: number; lastCommit: string }>;
};

export function useProjectDimensionColumns(): AxiTableColumn<ProjectRow>[] {
  const { t } = useI18n();

  return [
    {
      dataIndex: 'projectId',
      title: t('commitLedger.column.project') || '项目',
      width: 150,
    },
    {
      dataIndex: 'canonicalPath',
      title: t('commitLedger.column.path') || '路径',
      ellipsis: true,
      render: (value) => (
        <Tooltip title={value}>
          <code style={{ fontSize: 11 }}>{value}</code>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'branch',
      title: t('commitLedger.column.branch') || '分支',
      width: 120,
    },
    {
      dataIndex: 'head',
      title: 'HEAD',
      width: 80,
      render: (value) => value ? <code style={{ fontSize: 11 }}>{value.slice(0, 7)}</code> : '—',
    },
    {
      dataIndex: 'ahead',
      title: t('commitLedger.column.ahead') || 'Ahead',
      width: 70,
      render: (value) => value ? <span style={{ color: value > 0 ? 'var(--palette-orange-500)' : undefined }}>+{value}</span> : '—',
    },
    {
      dataIndex: 'behind',
      title: t('commitLedger.column.behind') || 'Behind',
      width: 70,
      render: (value) => value ? <span style={{ color: value > 0 ? 'var(--color-chart-1)' : undefined }}>-{value}</span> : '—',
    },
    {
      dataIndex: 'isDirty',
      title: t('commitLedger.column.dirty') || 'Dirty',
      width: 70,
      render: (value) => value ? (
        <AxiTag color="red">Dirty</AxiTag>
      ) : (
        <AxiTag color="green">Clean</AxiTag>
      ),
    },
    {
      dataIndex: 'commitCount',
      title: t('commitLedger.column.commits') || '提交',
      width: 70,
      align: 'right' as const,
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
  ];
}

export function buildProjectRows(
  projectsData: CommitLedgerProjectsData | undefined,
  summary: CommitLedgerSummary | undefined,
): ProjectRow[] {
  if (!projectsData?.projects || !summary) return [];
  // This would ideally come from a dedicated endpoint, but we derive from summary
  return projectsData.projects.map((p) => ({
    projectId: p.projectId,
    canonicalPath: '', // Would come from project details
    branch: undefined,
    head: undefined,
    ahead: undefined,
    behind: undefined,
    isDirty: false,
    lastCommitAt: p.lastCommit,
    verificationStatus: 'unverified',
    commitCount: p.commitCount,
  }));
}
