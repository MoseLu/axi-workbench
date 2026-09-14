import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHandoffQuery, acceptHandoff, rejectHandoff } from '../lib/mobileControl';
import { useMobileI18n } from '../i18n';
import { formatProjectionTime } from '../components/MobileProjectionState';
import { MobileIcon } from '../components/MobileIcons';

export default function HandoffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const handoff = useHandoffQuery(id ?? '');
  const [actionMessage, setActionMessage] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleAccept = async () => {
    if (!id) return;
    setIsAccepting(true);
    setActionMessage('');
    try {
      await acceptHandoff(id);
      setActionMessage(t('handoff.detail.acceptSuccess'));
      setTimeout(() => navigate('/workspace'), 1000);
    } catch {
      setActionMessage(t('handoff.detail.error'));
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setIsRejecting(true);
    setActionMessage('');
    try {
      await rejectHandoff(id, rejectReason || t('handoff.detail.rejectReason'));
      setActionMessage(t('handoff.detail.rejectSuccess'));
      setTimeout(() => navigate('/workspace'), 1000);
    } catch {
      setActionMessage(t('handoff.detail.error'));
    } finally {
      setIsRejecting(false);
    }
  };

  const data = handoff.data;

  return (
    <section className="axi-mobile-page" aria-busy={handoff.isFetching || isAccepting || isRejecting}>
      <div className="axi-mobile-page-intro">
        <div>
          <h1>{t('handoff.detail.title')}</h1>
        </div>
        <button
          type="button"
          className="axi-mobile-back-button"
          onClick={() => navigate('/handoffs')}
          aria-label={t('common.back')}
        >
          <MobileIcon name="back" size={20} />
        </button>
      </div>

      {handoff.isPending ? (
        <div className="axi-mobile-projection-state" role="status">
          {t('handoff.incoming.loading')}
        </div>
      ) : null}

      {handoff.isError ? (
        <div className="axi-mobile-projection-state is-error" role="alert">
          <span>{t('handoff.incoming.failed')}</span>
          <button type="button" onClick={() => void handoff.refetch()}>
            {t('handoff.incoming.retry')}
          </button>
        </div>
      ) : null}

      {actionMessage ? (
        <p className="axi-mobile-action-result" role="status">{actionMessage}</p>
      ) : null}

      {data ? (
        <>
          <div className="axi-mobile-detail-card">
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">ID</span>
              <span className="axi-mobile-detail-value">{data.id}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Type</span>
              <span className="axi-mobile-detail-value">{data.object.type}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Project</span>
              <span className="axi-mobile-detail-value">{data.object.projectId || '-'}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Action</span>
              <span className="axi-mobile-detail-value">{data.object.actionType || data.actionLevel}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Impact</span>
              <span className="axi-mobile-detail-value">{data.impact}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Risk</span>
              <span className={`axi-mobile-detail-value risk-${data.riskLevel}`}>{data.riskLevel}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Status</span>
              <span className="axi-mobile-detail-value">{data.status}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Created</span>
              <span className="axi-mobile-detail-value">{formatProjectionTime(data.createdAt)}</span>
            </div>
            <div className="axi-mobile-detail-row">
              <span className="axi-mobile-detail-label">Expires</span>
              <span className="axi-mobile-detail-value">{formatProjectionTime(data.expiresAt)}</span>
            </div>
          </div>

          {data.status === 'pending' ? (
            <div className="axi-mobile-action-group">
              <button
                type="button"
                className="axi-mobile-button axi-mobile-button--primary"
                disabled={isAccepting || isRejecting}
                onClick={handleAccept}
              >
                {isAccepting ? t('handoff.detail.accepting') : t('handoff.detail.accept')}
              </button>

              {!showRejectInput ? (
                <button
                  type="button"
                  className="axi-mobile-button axi-mobile-button--secondary"
                  disabled={isAccepting || isRejecting}
                  onClick={() => setShowRejectInput(true)}
                >
                  {t('handoff.detail.reject')}
                </button>
              ) : (
                <div className="axi-mobile-reject-form">
                  <input
                    type="text"
                    className="axi-mobile-input"
                    placeholder={t('handoff.detail.rejectReason')}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    disabled={isRejecting}
                  />
                  <div className="axi-mobile-button-group">
                    <button
                      type="button"
                      className="axi-mobile-button axi-mobile-button--danger"
                      disabled={isRejecting}
                      onClick={handleReject}
                    >
                      {isRejecting ? t('handoff.detail.rejecting') : t('handoff.detail.reject')}
                    </button>
                    <button
                      type="button"
                      className="axi-mobile-button axi-mobile-button--ghost"
                      disabled={isRejecting}
                      onClick={() => {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }}
                    >
                      {t('common.back')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
