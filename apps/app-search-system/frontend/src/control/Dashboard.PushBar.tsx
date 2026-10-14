/**
 * Dashboard.PushBar —— 推送按钮栏 + 推送日志。
 * 从原 Dashboard.tsx 中抽出,保留视图与状态绑定。
 */
import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { SopCardResult } from '../shared/components/ImageGrid';
import { RenderableSopPage, IconPush, PushLogEntry, nextPushLogId } from './Dashboard.utils';

interface PushBarProps {
  selectedPdfGroup: SopCardResult | null;
  renderablePages: RenderableSopPage[];
  selectedStartPageIndex: number;
  onStartPageIndexChange: (next: number) => void;
  lineCascadeEnabled: boolean;
  canEnableLineCascade: boolean;
  onToggleLineCascade: (next: boolean) => void;
  cascadeHint: string;
  pushBtnLabel: string;
  canPush: boolean;
  sending: boolean;
  onPush: () => void;
}

export interface PushBarHandle {
  addPushLog: (action: string, target: string, result: string, ok: boolean) => void;
}

const PushBar = forwardRef<PushBarHandle, PushBarProps>(function PushBar(
  {
    selectedPdfGroup,
    renderablePages,
    selectedStartPageIndex,
    onStartPageIndexChange,
    lineCascadeEnabled,
    canEnableLineCascade,
    onToggleLineCascade,
    cascadeHint,
    pushBtnLabel,
    canPush,
    sending,
    onPush,
  },
  ref
) {
  const [pushLog, setPushLog] = useState<PushLogEntry[]>([]);

  const addPushLog = useCallback(
    (action: string, target: string, result: string, ok: boolean) => {
      const entry: PushLogEntry = {
        id: nextPushLogId(),
        time: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        action,
        target,
        result,
        ok,
      };
      setPushLog(prev => [entry, ...prev].slice(0, 15));
    },
    []
  );

  useImperativeHandle(
    ref,
    () => ({
      addPushLog,
    }),
    [addPushLog]
  );

  return (
    <>
      <div
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* 已选 SOP 提示 */}
        {selectedPdfGroup ? (
          <div
            style={{
              flex: 1,
              fontSize: 13,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            已选:{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {selectedPdfGroup.job_name || '未知作业'}
            </span>{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              （{selectedPdfGroup.page_range || ''}页）
            </span>
          </div>
        ) : (
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
            请从上方选择要推送的 SOP
          </div>
        )}

        {renderablePages.length > 0 && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            <span>起始图</span>
            <select
              value={selectedStartPageIndex}
              onChange={e => onStartPageIndexChange(Number(e.target.value))}
              style={{
                height: 32,
                minWidth: 152,
                padding: '0 10px',
                fontSize: 12,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            >
              {renderablePages.map((page, index) => (
                <option key={`${page.page_num}-${index}`} value={index}>
                  {`第 ${index + 1} 张（PDF 第 ${page.page_num + 1} 页）`}
                </option>
              ))}
            </select>
          </label>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: canEnableLineCascade ? 'var(--text-secondary)' : 'var(--text-muted)',
            flexShrink: 0,
            cursor: canEnableLineCascade ? 'pointer' : 'not-allowed',
          }}
        >
          <input
            type="checkbox"
            checked={lineCascadeEnabled}
            disabled={!canEnableLineCascade}
            onChange={e => onToggleLineCascade(e.target.checked)}
            style={{ cursor: canEnableLineCascade ? 'pointer' : 'not-allowed' }}
          />
          <span>按产线顺推</span>
        </label>

        {cascadeHint && (
          <div
            style={{
              fontSize: 12,
              color: lineCascadeEnabled ? 'var(--accent)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {cascadeHint}
          </div>
        )}

        {/* 推送按钮 */}
        <button
          onClick={canPush ? onPush : undefined}
          disabled={!canPush || sending}
          style={{
            padding: '7px 20px',
            background: canPush && !sending ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: canPush && !sending ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 6,
            cursor: canPush && !sending ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: sending ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {canPush && !sending && <IconPush />}
          {sending ? '推送中...' : pushBtnLabel}
        </button>
      </div>

      {/* 推送日志 */}
      {pushLog.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '6px 16px',
            background: 'var(--bg-secondary)',
            maxHeight: 120,
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              推送记录
            </span>
            <button
              onClick={() => setPushLog([])}
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              清空
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pushLog.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  fontSize: 11,
                  padding: '2px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    color: entry.ok ? 'var(--accent)' : 'var(--axi-danger, #ef4444)',
                    fontWeight: 600,
                    minWidth: 60,
                  }}
                >
                  {entry.action}
                </span>
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                  {entry.target} · {entry.result}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{entry.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
});

export default PushBar;
