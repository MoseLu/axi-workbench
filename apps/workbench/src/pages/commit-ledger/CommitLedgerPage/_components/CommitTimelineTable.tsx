/**
 * Commit Ledger — commit timeline table (+ empty state).
 *
 * Moved verbatim out of `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). Rendering is unchanged: the same `AxiTableGroup`
 * wrapper, the same `AxiTable` props, and the same `commit-ledger-empty` block.
 */

// axi-ui-escape-hatch: antd Tooltip 暂时保留 — @axi/ui 暂无 AxiTooltip 等价
// primitive，沿用原 CommitLedgerPage.tsx 的实现。
import type React from 'react';
import { Tooltip } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useI18n } from '../../../../i18n';
import type { CommitRow } from '../types';

export type CommitTimelineTableProps = {
  columns: AxiTableColumn<CommitRow>[];
  rows: CommitRow[];
  /** Unfiltered commit count, used for the "n/m 条记录" description. */
  totalCount: number;
  loading: boolean;
  pagination: React.ComponentProps<typeof AxiTable>['pagination'];
  showEmpty: boolean;
  onRowClick: (record: CommitRow) => void;
};

export function CommitTimelineTable({
  columns,
  rows,
  totalCount,
  loading,
  pagination,
  showEmpty,
  onRowClick,
}: CommitTimelineTableProps) {
  const { t } = useI18n();

  return (
    <>
      <AxiTableGroup
        className="commit-ledger-timeline"
        description={
          rows.length !== totalCount
            ? `${rows.length}/${totalCount}${t('commitLedger.table.filtered') || '条记录'}`
            : `${totalCount}${t('commitLedger.table.records') || '条记录'}`
        }
        title={t('commitLedger.timeline.title') || '提交时间线'}
      >
        <AxiTable
          columns={columns}
          data={rows}
          loading={loading}
          pagination={pagination}
          rowKey="recordId"
          size="small"
          onRow={(row) => ({
            onClick: () => onRowClick(row),
            style: { cursor: 'pointer' },
          })}
        />
      </AxiTableGroup>

      {/* Empty State */}
      {showEmpty && (
        <div className="commit-ledger-empty">
          <div className="wb-empty" role="status">
            {t('commitLedger.empty.description') || '暂无提交记录'}
          </div>
        </div>
      )}
    </>
  );
}
