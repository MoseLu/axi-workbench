/**
 * DeviceManagement.PasswordDialog —— 批量修改密码 / 安装清单弹窗。
 * 从原 DeviceManagement.tsx 中抽出,保留视图与原交互。
 */
import React from 'react';
import apiClient from '../shared/api/client';
import { buildInstallSheetText } from './DeviceManagement.utils';

interface BatchPasswordDialogProps {
  open: boolean;
  password: string;
  onPasswordChange: (next: string) => void;
  onCancel: () => void;
  totalDevices: number;
  showToast: (text: string, type: 'success' | 'error') => void;
  onUpdated: () => void;
}

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

const cancelButtonStyle: React.CSSProperties = {
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
  background: 'var(--axi-warning, #f59e0b)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'white',
  fontWeight: 600,
};

export function BatchPasswordDialog({
  open,
  password,
  onPasswordChange,
  onCancel,
  totalDevices,
  showToast,
  onUpdated,
}: BatchPasswordDialogProps) {
  if (!open) return null;

  const handleSubmit = async () => {
    if (!password.trim()) {
      showToast('密码不能为空', 'error');
      return;
    }
    try {
      await apiClient.updateAllDevicesPassword(password.trim());
      onUpdated();
      showToast('密码已统一修改', 'success');
    } catch (e) {
      showToast('修改失败: ' + (e as Error).message, 'error');
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
          minWidth: 320,
          maxWidth: 400,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary)' }}>
          统一修改所有设备密码
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          将所有 {totalDevices} 台设备的密码统一修改为：
        </p>
        <input
          type="text"
          value={password}
          onChange={e => onPasswordChange(e.target.value)}
          placeholder="输入新密码"
          autoFocus
          style={{ ...inputStyle, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelButtonStyle}>
            取消
          </button>
          <button onClick={() => void handleSubmit()} style={confirmButtonStyle}>
            确认修改
          </button>
        </div>
      </div>
    </div>
  );
}

interface InstallSheetDialogProps {
  open: boolean;
  text: string;
  onCancel: () => void;
  onCopy: () => void;
}

const sheetTextareaStyle: React.CSSProperties = {
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

const sheetCopyButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  background: 'var(--axi-primary-hover, #3b82f6)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'white',
  fontWeight: 600,
};

const sheetCloseButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-primary)',
};

export function InstallSheetDialog({ open, text, onCancel, onCopy }: InstallSheetDialogProps) {
  if (!open) return null;

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
          minWidth: 460,
          maxWidth: 760,
          width: '70vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>安装清单</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          当前清单基于系统内设备数据生成，不依赖外部 xlsx/csv。你可以按产线筛选后再打开这里复制给安装人员。
        </p>
        <textarea readOnly value={text} rows={18} style={sheetTextareaStyle} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCopy} style={sheetCopyButtonStyle}>
            复制清单
          </button>
          <button onClick={onCancel} style={sheetCloseButtonStyle}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 给定筛选后的设备列表,生成安装清单文本。
 * 仅在此处暴露,因为 InstallSheetDialog 的视图需要。
 */
export function generateInstallSheet(devices: Device[]): string {
  return buildInstallSheetText(devices);
}
