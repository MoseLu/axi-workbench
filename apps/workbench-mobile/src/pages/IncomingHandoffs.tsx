import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { useIncomingHandoffsQuery, type IncomingHandoff } from '../lib/mobileControl';
import { useMobileI18n } from '../i18n';
import { formatProjectionTime } from '../components/MobileProjectionState';

const STATUS_KEYS: Record<IncomingHandoff['status'], string> = {
  pending: 'handoff.incoming.status.pending',
  opened: 'handoff.incoming.status.opened',
  completed: 'handoff.incoming.status.completed',
  rejected: 'handoff.incoming.status.rejected',
  expired: 'handoff.incoming.status.expired',
};

export default function IncomingHandoffs() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const handoffs = useIncomingHandoffsQuery({ status: 'opened' });
  const records = handoffs.data ?? [];

  return (
    <section className="axi-mobile-page" aria-busy={handoffs.isFetching}>
      <div className="axi-mobile-page-intro axi-mobile-page-intro--with-action">
        <div>
          <h1>{t('handoff.incoming.title')}</h1>
          <p>{t('handoff.incoming.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void handoffs.refetch()}>
          {t('handoff.incoming.retry')}
        </button>
      </div>

      {handoffs.isPending ? (
        <div className="axi-mobile-projection-state" role="status">
          {t('handoff.incoming.loading')}
        </div>
      ) : null}

      {handoffs.isError ? (
        <div className="axi-mobile-projection-state is-error" role="alert">
          <span>{t('handoff.incoming.failed')}</span>
          <button type="button" onClick={() => void handoffs.refetch()}>
            {t('handoff.incoming.retry')}
          </button>
        </div>
      ) : null}

      {!handoffs.isPending && !handoffs.isError && records.length === 0 ? (
        <div className="axi-mobile-empty-card">{t('handoff.incoming.empty')}</div>
      ) : null}

      {records.length > 0 ? (
        <div className="axi-mobile-card-list axi-mobile-card-list--spaced" aria-live="polite">
          {records.map((record) => (
            <article
              className="axi-mobile-project-card axi-mobile-project-card--full"
              key={record.id}
              onClick={() => navigate(`/handoffs/${record.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(`/handoffs/${record.id}`);
              }}
            >
              <span className="axi-mobile-project-card__mark is-violet">
                <MobileIcon name="workspace" size={18} />
              </span>
              <span className="axi-mobile-project-card__body">
                <strong>{record.object.projectId || record.object.type || 'Unknown'}</strong>
                <small>{record.object.actionType || record.object.actionId || record.actionLevel}</small>
                <small>{t('handoff.incoming.status.pending')} {formatProjectionTime(record.createdAt)}</small>
                {record.rejectionReason ? (
                  <small>{t('handoff.detail.rejectReason')}: {record.rejectionReason}</small>
                ) : null}
              </span>
              <span className="axi-mobile-project-card__aside">
                <b>{t(STATUS_KEYS[record.status] as any)}</b>
                <MobileIcon name="arrow-right" size={17} />
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
