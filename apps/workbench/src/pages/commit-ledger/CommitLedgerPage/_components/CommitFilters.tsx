/**
 * Commit Ledger — filter row (project / type / verification status / dirty).
 *
 * Moved verbatim out of `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). Uses only the Axi widget surface, so it carries no
 * antd escape hatch.
 */

import { AxiRow, AxiSelect } from '@axi/widgets';
import { useI18n } from '../../../../i18n';
import { COMMIT_TYPES, DIRTY_OPTIONS, VERIFICATION_STATUSES } from '../constants';
import type { CommitLedgerFilters } from '../types';

export function CommitFilters({
  filters,
  projectOptions,
  onFilterChange,
}: {
  filters: CommitLedgerFilters;
  projectOptions: Array<{ value: string; label: string }>;
  onFilterChange: (key: keyof CommitLedgerFilters, value: string | boolean | null) => void;
}) {
  const { t } = useI18n();

  return (
    <AxiRow style={{ gap: 'var(--axi-space-2, 8px)', flexWrap: 'wrap' }}>
      <AxiSelect
        allowClear
        aria-label={t('commitLedger.filter.project') || 'Filter by project'}
        placeholder={t('commitLedger.filter.project') || '项目'}
        style={{ minWidth: 150 }}
        value={filters.projectId}
        onChange={(val: unknown) => onFilterChange('projectId', (val as string | undefined) ?? null)}
        options={projectOptions}
      />
      <AxiSelect
        allowClear
        aria-label={t('commitLedger.filter.type') || 'Filter by type'}
        placeholder={t('commitLedger.filter.type') || '类型'}
        style={{ minWidth: 120 }}
        value={filters.type}
        onChange={(val: unknown) => onFilterChange('type', (val as string | undefined) ?? null)}
        options={COMMIT_TYPES}
      />
      <AxiSelect
        allowClear
        aria-label={t('commitLedger.filter.status') || 'Filter by verification status'}
        placeholder={t('commitLedger.filter.status') || '验证状态'}
        style={{ minWidth: 120 }}
        value={filters.verificationStatus}
        onChange={(val: unknown) => onFilterChange('verificationStatus', (val as string | undefined) ?? null)}
        options={VERIFICATION_STATUSES}
      />
      <AxiSelect
        allowClear
        aria-label={t('commitLedger.filter.dirty') || 'Filter by dirty state'}
        placeholder={t('commitLedger.filter.dirty') || 'Dirty'}
        style={{ minWidth: 100 }}
        value={filters.isDirty === undefined ? undefined : String(filters.isDirty)}
        onChange={(val: unknown) => onFilterChange('isDirty', val === undefined ? null : String(val) === 'true')}
        options={DIRTY_OPTIONS}
      />
    </AxiRow>
  );
}
