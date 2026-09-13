import { MobileIcon } from '../components/MobileIcons';
import { MobileProjectionState, formatProjectionTime } from '../components/MobileProjectionState';
import { useMobileDeviceSession, useMobileHandoffsQuery, type MobileHandoff } from '../lib/mobileControl';
import { useMobileI18n, type MobileCopyKey } from '../i18n';

const STATUS_KEYS: Record<MobileHandoff['status'], MobileCopyKey> = {
  pending: 'handoff.status.pending',
  opened: 'handoff.status.opened',
  completed: 'handoff.status.completed',
  rejected: 'handoff.status.rejected',
  expired: 'handoff.status.expired',
};

export default function HandoffPage() {
  const { t } = useMobileI18n();
  const session = useMobileDeviceSession();
  const handoffs = useMobileHandoffsQuery();
  const records = handoffs.data?.handoffs ?? [];

  return (
    <section className="axi-mobile-page" aria-busy={handoffs.isFetching}>
      <div className="axi-mobile-page-intro axi-mobile-page-intro--with-action">
        <div><h1>{t('page.handoff')}</h1><p>{t('handoff.subtitle')}</p></div>
        {session ? <button type="button" onClick={() => void handoffs.refetch()}>{t('common.refresh')}</button> : null}
      </div>
      <MobileProjectionState session={session} isLoading={handoffs.isPending} error={undefined} onRefresh={() => void handoffs.refetch()} />
      {session && handoffs.isError ? <div className="axi-mobile-projection-state is-error" role="alert"><strong>{t('handoff.failed')}</strong><button type="button" onClick={() => void handoffs.refetch()}>{t('common.retry')}</button></div> : null}
      {session && !handoffs.isPending && !handoffs.isError && records.length === 0 ? <div className="axi-mobile-empty-card">{t('handoff.empty')}</div> : null}
      {records.length > 0 ? (
        <div className="axi-mobile-card-list axi-mobile-card-list--spaced" aria-live="polite">
          {records.map((record) => (
            <article className="axi-mobile-project-card axi-mobile-project-card--full" key={record.id}>
              <span className="axi-mobile-project-card__mark is-violet"><MobileIcon name="workspace" size={18} /></span>
              <span className="axi-mobile-project-card__body">
                <strong>{record.object.projectId || t('handoff.unknownProject')}</strong>
                <small>{record.object.actionType || record.object.actionId || t('handoff.unknownAction')}</small>
                <small>{t('handoff.createdAt')} {formatProjectionTime(record.createdAt)}</small>
                {record.rejectionReason ? <small>{t('handoff.rejectionReason')}: {record.rejectionReason}</small> : null}
              </span>
              <span className="axi-mobile-project-card__aside"><b>{t(STATUS_KEYS[record.status])}</b><MobileIcon name="arrow-right" size={17} /></span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
