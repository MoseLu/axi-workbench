/**
 * Commit Ledger Page
 * Axi Workbench Operations - Commit Ledger View
 *
 * Features:
 * - Workspace Commit Overview (summary stats)
 * - Project Dimension Table
 * - Commit Timeline (main table)
 * - Commit Detail View (Drawer)
 * - Filters (project, type, verification status, dirty, time range)
 * - States: Loading, Empty, Offline, Partial, Stale, Error, Unknown
 *
 * 2026-10-14 architecture sweep (W4): split from the former 963-line
 * `commit-ledger/CommitLedgerPage.tsx` into this entry plus `_components/*`
 * (search bar, filters, summary cards, timeline table, detail drawer, timeline
 * columns) and the shared `types.ts` / `constants.tsx` / `utils.ts` /
 * `projectDimension.tsx` modules. Rendering is unchanged.
 */

// axi-ui-escape-hatch: antd Button 暂时保留 — @axi/ui 暂无「带 loading 状态的刷新
// 按钮」等价组合（CRUD frame 顶部刷新动作），等 @axi/widgets 对应 primitive 上线后
// 再替换。搜索输入已下沉到 _components/CommitSearchBar.tsx。
import { Button } from 'antd';
import { useMemo, useState } from 'react';
import {
  useCommitLedgerCommits,
  useCommitLedgerProjects,
  useCommitLedgerSummary,
} from '../../../hooks/useCommitLedger';
import { ControlPlaneState } from '../../admin/ControlPlaneState';
import { DesktopCrudFrame } from '../../admin/DesktopCrudFrame';
import { desktopCrudPagination, DESKTOP_CRUD_PAGE_SIZE } from '../../admin/tenantMemberCrud';
import { useI18n } from '../../../i18n';
import { CommitDetailDrawer } from './_components/CommitDetailDrawer';
import { CommitFilters } from './_components/CommitFilters';
import { CommitSearchBar } from './_components/CommitSearchBar';
import { CommitTimelineTable } from './_components/CommitTimelineTable';
import { SummaryCards } from './_components/SummaryCards';
import { useCommitColumns } from './_components/useCommitColumns';
import type { CommitLedgerFilters, CommitRow } from './types';
import { filterByKeyword, recordToCommitRow } from './utils';
import '../CommitLedger.css';

export function CommitLedgerPage() {
  const { t } = useI18n();

  // State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DESKTOP_CRUD_PAGE_SIZE);
  const [filters, setFilters] = useState<CommitLedgerFilters>({});
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Data fetching
  const {
    data: summaryData,
    isFetching: isFetchingSummary,
    isLoading: isLoadingSummary,
    isError: isErrorSummary,
    refetch: refetchSummary
  } = useCommitLedgerSummary();

  const {
    data: commitsData,
    isFetching: isFetchingCommits,
    isLoading: isLoadingCommits,
    isError: isErrorCommits
  } = useCommitLedgerCommits(page, limit, {
      ...filters,
      isDirty: filters.isDirty === null ? undefined : filters.isDirty,
    });

  const { data: projectsData } = useCommitLedgerProjects();

  // Derived state
  const summary = summaryData?.workspace;
  const commits = commitsData?.data ?? [];
  const pagination = commitsData?.pagination;
  const projectOptions = useMemo(() => {
    if (!projectsData?.projects) return [];
    return projectsData.projects.map((p) => ({
      value: p.projectId,
      label: p.projectId,
    }));
  }, [projectsData]);

  // Filter by keyword
  const filteredCommits = useMemo(
    () => filterByKeyword(commits.map(recordToCommitRow), keyword, (row) => [
      row.subject,
      row.authorName,
      row.projectId,
      row.shortSha,
      row.type,
      row.scope,
    ]),
    [commits, keyword],
  );

  // Table columns
  const commitColumns = useCommitColumns((recordId) => {
    setSelectedRecordId(recordId);
    setDrawerOpen(true);
  });

  // Actions
  const runSearch = () => setKeyword(keywordDraft.trim());
  const handleFilterChange = (key: keyof CommitLedgerFilters, value: string | boolean | null) => {
    setPage(1);
    setFilters((prev) => {
      if (value === null || value === '' || (typeof value === 'boolean' && value === null)) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };
  const handleRowClick = (record: CommitRow) => {
    setSelectedRecordId(record.recordId);
    setDrawerOpen(true);
  };

  // State detection
  const showError = (isErrorSummary || isErrorCommits) && !summary && !commits.length;
  const showLoading = (isLoadingSummary || isLoadingCommits) && !summary && !commits.length;
  const showEmpty = !showLoading && !showError && commits.length === 0 && summary;

  // Get pagination config
  const tablePagination = useMemo(() => {
    if (!pagination) return false;
    return {
      ...desktopCrudPagination(pagination.total),
      current: page,
      pageSize: limit,
      onChange: (newPage: number, newLimit: number) => {
        setPage(newPage);
        setLimit(newLimit);
      },
    };
  }, [pagination, page, limit]);

  return (
    <DesktopCrudFrame
      ariaLabel={t('commitLedger.title') || 'Commit Ledger'}
      className="commit-ledger-crud"
      search={!showError && !showLoading ? (
        <CommitSearchBar
          value={keywordDraft}
          onChange={setKeywordDraft}
          onClear={() => { setKeywordDraft(''); setKeyword(''); }}
          onSearch={runSearch}
        />
      ) : undefined}
      filters={!showError && !showLoading ? (
        <CommitFilters
          filters={filters}
          projectOptions={projectOptions}
          onFilterChange={handleFilterChange}
        />
      ) : undefined}
      top={!showError && !showLoading ? (
        <div className="wb-crud-action-cluster">
          <Button
            loading={isFetchingSummary || isFetchingCommits}
            onClick={() => void refetchSummary()}
          >
            {t('common.refresh') || '刷新'}
          </Button>
        </div>
      ) : undefined}
    >
      {showError ? (
        <ControlPlaneState
          actionLabel={t('common.retry') || '重试'}
          actionLoading={isFetchingSummary}
          description={t('commitLedger.error.description') || '无法加载提交账本数据'}
          title={t('commitLedger.error.title') || '加载失败'}
          onAction={() => void refetchSummary()}
        />
      ) : showLoading ? (
        <ControlPlaneState
          description={t('commitLedger.loading.description') || '正在加载提交账本...'}
          loading
          title={t('commitLedger.loading.title') || '加载中'}
        />
      ) : (
        <div className="commit-ledger-grid">
          {/* Summary Cards */}
          <SummaryCards
            summary={summary}
            loading={isLoadingSummary}
            onRefresh={() => void refetchSummary()}
            isFetching={isFetchingSummary}
          />

          {/* Main Content */}
          <div className="commit-ledger-main">
            {/* Commit Timeline Table */}
            <CommitTimelineTable
              columns={commitColumns}
              rows={filteredCommits}
              totalCount={commits.length}
              loading={isFetchingCommits && !commits.length}
              pagination={tablePagination}
              showEmpty={Boolean(showEmpty)}
              onRowClick={handleRowClick}
            />
          </div>
        </div>
      )}

      {/* Commit Detail Drawer */}
      <CommitDetailDrawer
        recordId={selectedRecordId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </DesktopCrudFrame>
  );
}

export default CommitLedgerPage;
