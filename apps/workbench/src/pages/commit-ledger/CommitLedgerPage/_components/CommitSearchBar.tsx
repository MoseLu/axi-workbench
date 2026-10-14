/**
 * Commit Ledger — search bar (keyword draft + submit).
 *
 * Moved verbatim out of `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). The draft/submitted keyword split is unchanged.
 */

// axi-ui-escape-hatch: antd Input/Button 暂时保留 — @axi/ui 暂无「带 allowClear +
// onPressEnter + onClear 的搜索输入」等价组合，沿用原 CommitLedgerPage.tsx 的实现。
import { Button, Input } from 'antd';
import { useI18n } from '../../../../i18n';

export function CommitSearchBar({
  value,
  onChange,
  onClear,
  onSearch,
}: {
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
  onSearch: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="wb-crud-search-cluster">
      <Input
        allowClear
        aria-label={t('commitLedger.search.ariaLabel') || 'Search commits'}
        placeholder={t('commitLedger.search.placeholder') || 'Search subject, author, SHA...'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClear={onClear}
        onPressEnter={onSearch}
      />
      <Button type="primary" onClick={onSearch}>{t('common.search') || '搜索'}</Button>
    </div>
  );
}
