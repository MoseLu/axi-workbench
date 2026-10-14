/**
 * Commit Ledger — commit detail drawer.
 *
 * Moved verbatim out of `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). Rendering is unchanged.
 */

// axi-ui-escape-hatch: antd Drawer/Spin + @ant-design/icons 暂时保留 — @axi/ui 暂无
// AxiDrawer / AxiSpin 等价 primitive，沿用原 CommitLedgerPage.tsx 的实现。
import { Drawer, Spin } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { AxiTag } from '@axi/core';
import { useCommitLedgerRecord } from '../../../../hooks/useCommitLedger';
import { useI18n } from '../../../../i18n';
import { STATUS_CONFIG, TYPE_COLORS } from '../constants';
import { formatTime } from '../utils';

export function CommitDetailDrawer({
  recordId,
  open,
  onClose,
}: {
  recordId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { data: record, isLoading } = useCommitLedgerRecord(recordId ?? undefined);

  return (
    <Drawer
      title={t('commitLedger.detail.title') || '提交详情'}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : record ? (
        <div className="commit-detail">
          {/* SHA */}
          <div className="detail-section">
            <label className="detail-label">SHA</label>
            <div className="detail-value">
              <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{record.commit.sha}</code>
            </div>
          </div>

          {/* Parent SHAs */}
          {record.commit.parentShas?.length > 0 && (
            <div className="detail-section">
              <label className="detail-label">Parent</label>
              <div className="detail-value">
                {record.commit.parentShas.map((sha, i) => (
                  <code key={i} style={{ fontSize: 12, marginRight: 8 }}>{sha.slice(0, 8)}</code>
                ))}
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.subject') || 'Subject'}</label>
            <strong className="detail-value">{record.commit.subject}</strong>
          </div>

          {/* Body */}
          {record.commit.body && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.body') || 'Body'}</label>
              <p className="detail-value" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {record.commit.body}
              </p>
            </div>
          )}

          {/* Type / Scope */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.type') || 'Type'}</label>
            <div className="detail-value">
              <AxiTag color={TYPE_COLORS[record.commit.type] || 'default'}>
                {record.commit.type}
                {record.commit.scope && `:${record.commit.scope}`}
              </AxiTag>
              {record.commit.breaking && <AxiTag color="red">BREAKING</AxiTag>}
            </div>
          </div>

          {/* Author / Committer */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.author') || 'Author'}</label>
            <div className="detail-value">
              {record.actor.name}
              {record.actor.email && <span style={{ color: 'var(--palette-gray-500)', marginLeft: 8 }}>&lt;{record.actor.email}&gt;</span>}
            </div>
          </div>

          {/* Times */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.times') || '时间'}</label>
            <div className="detail-value">
              <div>{t('commitLedger.detail.authoredAt') || 'Authored'}: {formatTime(record.commit.authoredAt)}</div>
              <div>{t('commitLedger.detail.committedAt') || 'Committed'}: {formatTime(record.commit.committedAt)}</div>
            </div>
          </div>

          {/* Branch / Tags */}
          {record.refs && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.refs') || 'Refs'}</label>
              <div className="detail-value">
                {record.refs.branches?.map((b, i) => (
                  <AxiTag key={`b-${i}`} color="blue">{b}</AxiTag>
                ))}
                {record.refs.tags?.map((t2, i) => (
                  <AxiTag key={`t-${i}`} color="green">{t2}</AxiTag>
                ))}
              </div>
            </div>
          )}

          {/* Diff Stat */}
          {record.diff && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.diff') || 'Diff'}</label>
              <div className="detail-value">
                <AxiTag icon={<CodeOutlined />} color="blue">
                  {record.diff.filesChanged ?? 0} files
                </AxiTag>
                <AxiTag color="green">+{record.diff.insertions ?? 0}</AxiTag>
                <AxiTag color="red">-{record.diff.deletions ?? 0}</AxiTag>
              </div>
            </div>
          )}

          {/* Workspace State */}
          {record.workspaceState && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.workspace') || '工作区'}</label>
              <div className="detail-value">
                <div>
                  {t('commitLedger.detail.branch') || 'Branch'}: {record.workspaceState.observedBranch ?? '—'}
                </div>
                <div>
                  {t('commitLedger.detail.dirty') || 'Dirty'}:
                  {record.workspaceState.isDirty ? (
                    <AxiTag color="red">{t('common.yes') || '是'}</AxiTag>
                  ) : (
                    <AxiTag color="green">{t('common.no') || '否'}</AxiTag>
                  )}
                </div>
                {record.workspaceState.ahead !== undefined && (
                  <div>
                    {t('commitLedger.detail.ahead') || 'Ahead'}: {record.workspaceState.ahead}
                  </div>
                )}
                {record.workspaceState.behind !== undefined && (
                  <div>
                    {t('commitLedger.detail.behind') || 'Behind'}: {record.workspaceState.behind}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.verification') || '验证'}</label>
            <div className="detail-value">
              {(() => {
                const config = STATUS_CONFIG[record.verification?.status ?? 'unknown'];
                return (
                  <AxiTag color={config.color} icon={config.icon}>
                    {config.label}
                  </AxiTag>
                );
              })()}
            </div>
            {record.verification?.commands && record.verification.commands.length > 0 && (
              <div className="detail-subvalue">
                <label>{t('commitLedger.detail.commands') || 'Commands'}:</label>
                <ul>
                  {record.verification.commands.map((cmd, i) => (
                    <li key={i}><code>{cmd}</code></li>
                  ))}
                </ul>
              </div>
            )}
            {record.verification?.evidenceRefs && record.verification.evidenceRefs.length > 0 && (
              <div className="detail-subvalue">
                <label>{t('commitLedger.detail.evidence') || 'Evidence'}:</label>
                <ul>
                  {record.verification.evidenceRefs.map((ref, i) => (
                    <li key={i}><code>{ref}</code></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Provenance */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.provenance') || '来源'}</label>
            <div className="detail-value">
              <div>Source: {record.provenance.source}</div>
              <div style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--palette-gray-500)' }}>
                {record.provenance.sourcePath}
              </div>
              {record.provenance.sourceCommand && (
                <div><code style={{ fontSize: 11 }}>{record.provenance.sourceCommand}</code></div>
              )}
              {record.provenance.sourceHash && (
                <div style={{ fontSize: 11, color: 'var(--palette-gray-500)' }}>
                  Hash: {record.provenance.sourceHash.slice(0, 8)}
                </div>
              )}
            </div>
          </div>

          {/* Ingestion */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.ingestion') || '摄取'}</label>
            <div className="detail-value">
              <div>Status: {record.ingestion.status}</div>
              <div style={{ fontSize: 12, color: 'var(--palette-gray-500)' }}>
                {t('commitLedger.detail.firstSeen') || 'First seen'}: {formatTime(record.ingestion.firstSeenAt)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--palette-gray-500)' }}>
                {t('commitLedger.detail.lastSeen') || 'Last seen'}: {formatTime(record.ingestion.lastSeenAt)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="wb-empty" role="status">{t('commitLedger.detail.notFound') || '记录不存在'}</div>
      )}
    </Drawer>
  );
}
