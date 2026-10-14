/**
 * 推送历史视图
 */
import apiClient from '../../../shared/api/client';
import type { DisplayHistoryEntry } from '../../recentHistory';
import { IconBack, IconPush, IconClipboard } from './icons';
import { buildHistoryMeta, formatHistoryTime } from '../utils';

interface PushHistoryViewProps {
  entries: DisplayHistoryEntry[];
  onBack: () => void;
  onOpenHistoryEntry: (entry: DisplayHistoryEntry) => void;
}

export default function PushHistoryView({ entries, onBack, onOpenHistoryEntry }: PushHistoryViewProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--axi-bg-page, #0d1117)', color: 'white', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 24px', background: 'var(--axi-text, #1e293b)', flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 40, padding: '0 16px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 14,
            flexShrink: 0,
          }}
        >
          <IconBack /> 返回
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconPush />
          <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>推送历史</span>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {entries.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '60vh', color: 'var(--axi-text-muted, #64748b)',
          }}>
            <IconPush />
            <div style={{ fontSize: 16, marginTop: 16 }}>暂无推送历史</div>
            <div style={{ fontSize: 13, marginTop: 8, color: 'var(--axi-text-secondary, #475569)' }}>
              中控端推送的 SOP 会显示在这里
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, color: 'var(--axi-text-muted, #94a3b8)' }}>
                共 {entries.length} 条推送记录
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {entries.map(entry => {
                const metaText = buildHistoryMeta(entry);
                const previewSrc = entry.previewPath ? apiClient.getImageUrl(entry.previewPath) : '';
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => { void onOpenHistoryEntry(entry); }}
                    style={{
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        alt={entry.jobName}
                        style={{
                          width: '100%', height: 160, objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: 160,
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconClipboard size={48} />
                      </div>
                    )}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: 'white',
                        marginBottom: 6,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.jobName || entry.pdfName || '无标题'}
                      </div>
                      {metaText && (
                        <div style={{
                          fontSize: 12, color: 'var(--axi-text-muted, #94a3b8)', marginBottom: 6,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {metaText}
                        </div>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        color: 'var(--axi-text-muted, #64748b)', fontSize: 12,
                      }}>
                        <span>{formatHistoryTime(entry.viewedAt)}</span>
                        <span style={{
                          padding: '2px 8px',
                          background: 'rgba(34,197,94,0.15)',
                          color: 'var(--axi-success, #4ade80)',
                          borderRadius: 4, fontSize: 11,
                        }}>
                          推送
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
