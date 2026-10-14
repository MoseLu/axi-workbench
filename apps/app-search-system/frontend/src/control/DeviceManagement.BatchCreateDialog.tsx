/**
 * DeviceManagement.BatchCreateDialog —— 批量生成设备位弹窗。
 * 从原 DeviceManagement.tsx 中抽出,保留视图与原交互。
 */
import React, { useMemo } from 'react';
import apiClient from '../shared/api/client';
import { buildBatchCreateDrafts } from './DeviceManagement.utils';

interface BatchCreateDialogProps {
  open: boolean;
  text: string;
  onTextChange: (next: string) => void;
  password: string;
  onPasswordChange: (next: string) => void;
  onCancel: () => void;
  onCreated: (count: number) => void;
  showToast: (text: string, type: 'success' | 'error') => void;
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  resize: 'vertical',
  padding: '10px 12px',
  fontSize: 13,
  lineHeight: 1.6,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

const previewBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-primary)',
};

const templateButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-primary)',
};

const confirmButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  background: 'var(--axi-success, #10b981)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'white',
  fontWeight: 600,
};

export default function BatchCreateDialog({
  open,
  text,
  onTextChange,
  password,
  onPasswordChange,
  onCancel,
  onCreated,
  showToast,
}: BatchCreateDialogProps) {
  const preview = useMemo(() => {
    if (!text.trim()) {
      return { total: 0, preview: [] as string[], error: '' };
    }
    try {
      const { devices: batchDevices, total } = buildBatchCreateDrafts(text, password);
      return {
        total,
        preview: batchDevices.slice(0, 8).map(item => item.sequence_num),
        error: '',
      };
    } catch (e) {
      return { total: 0, preview: [] as string[], error: (e as Error).message };
    }
  }, [password, text]);

  if (!open) return null;

  const handleSubmit = async () => {
    let draft;
    try {
      draft = buildBatchCreateDrafts(text, password);
    } catch (e) {
      showToast((e as Error).message, 'error');
      return;
    }
    if (draft.total === 0) {
      showToast('请先输入批量生成规则', 'error');
      return;
    }
    try {
      await apiClient.batchCreateDevices(draft.devices);
      onCreated(draft.total);
      showToast(`已批量创建 ${draft.total} 台设备位`, 'success');
    } catch (e) {
      showToast('批量创建失败: ' + (e as Error).message, 'error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px 28px',
          minWidth: 420,
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>批量生成设备位</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          每行填写一条产线和设备数量，系统会自动生成 `LineX-01` 这样的设备编号，并把产线分组设为 `LineX`。
        </p>
        <textarea
          value={text}
          onChange={e => onTextChange(e.target.value)}
          placeholder={'示例：\n1=8\n2=7\n3=9\n\n表示生成 Line1 的 8 台、Line2 的 7 台、Line3 的 9 台'}
          autoFocus
          rows={10}
          style={textareaStyle}
        />
        <input
          type="text"
          value={password}
          onChange={e => onPasswordChange(e.target.value)}
          placeholder="默认设备密码，默认 123456"
          style={inputStyle}
        />
        <div style={previewBoxStyle}>
          {preview.error ? (
            <span style={{ color: 'var(--axi-danger, #f87171)' }}>{preview.error}</span>
          ) : preview.total > 0 ? (
            <span>
              将创建 <strong style={{ color: 'var(--text-primary)' }}>{preview.total}</strong> 台设备。
              {preview.preview.length > 0
                ? ` 预览：${preview.preview.join('、')}${preview.total > preview.preview.length ? ' ...' : ''}`
                : ''}
            </span>
          ) : (
            <span>支持格式：`1=8`、`Line1=8`、`2,12`。</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelButtonStyle}>
            取消
          </button>
          <button
            onClick={() => {
              onTextChange(Array.from({ length: 17 }, (_, index) => `${index + 1}=`).join('\n'));
            }}
            style={templateButtonStyle}
          >
            生成17线模板
          </button>
          <button onClick={() => void handleSubmit()} style={confirmButtonStyle}>
            批量创建
          </button>
        </div>
      </div>
    </div>
  );
}
