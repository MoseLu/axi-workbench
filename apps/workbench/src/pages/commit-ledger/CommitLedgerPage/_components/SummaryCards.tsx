/**
 * Commit Ledger — Workspace Commit Overview (summary stat cards).
 *
 * Moved verbatim out of `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). Rendering is unchanged.
 */

// axi-ui-escape-hatch: antd Spin/Button + @ant-design/icons 暂时保留 — @axi/ui 暂无
// 「带 loading 状态的刷新按钮」与「小型内联 Spin」等价组合，沿用原
// CommitLedgerPage.tsx 的实现，等 @axi/widgets 对应 primitive 上线后再替换。
import { Button, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useI18n } from '../../../../i18n';
import type { CommitLedgerSummary } from '../../../../hooks/useCommitLedger';
import { formatRelativeTime } from '../utils';

export function SummaryCards({
  summary,
  loading,
  onRefresh,
  isFetching
}: {
  summary?: CommitLedgerSummary;
  loading: boolean;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const { t } = useI18n();

  if (loading && !summary) {
    return (
      <div className="commit-ledger-summary-cards">
        <div className="summary-card">
          <Spin size="small" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const coverage = summary.totalCommits > 0
    ? Math.round((summary.verifiedCommits / summary.totalCommits) * 100)
    : 0;

  return (
    <div className="commit-ledger-summary-cards">
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.projects') || '项目数'}</div>
        <div className="stat-value">{summary.totalProjects}</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.totalCommits') || '提交总数'}</div>
        <div className="stat-value">{summary.totalCommits}</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.recentCommits') || '最近提交'}</div>
        <div className="stat-value">{formatRelativeTime(summary.lastUpdated)}</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.verified') || '已验证'}</div>
        <div className="stat-value success">{summary.verifiedCommits}</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.unverified') || '未验证'}</div>
        <div className="stat-value warning">{summary.unverifiedCommits}</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.coverage') || '覆盖率'}</div>
        <div className="stat-value">{coverage}%</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.dirty') || 'Dirty'}</div>
        <div className="stat-value error">{summary.dirtyWorkspaces}</div>
      </div>
      <div className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.conflicts') || '冲突'}</div>
        <div className="stat-value error">{summary.conflictRecords}</div>
      </div>
      <div className="summary-card summary-card--refresh">
        <Button
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={onRefresh}
          loading={isFetching}
          size="small"
        >
          {t('common.refresh') || '刷新'}
        </Button>
      </div>
    </div>
  );
}
