/**
 * DeviceManagement.CreateDialog —— 新增设备位弹窗。
 * 从原 DeviceManagement.tsx 中抽出,保留视图与原交互。
 */
import React from 'react';
import apiClient from '../shared/api/client';
import { CreateForm, inferDeviceGroupFromSequence } from './DeviceManagement.utils';

interface CreateDeviceDialogProps {
  open: boolean;
  form: CreateForm;
  onChange: (next: CreateForm) => void;
  onCancel: () => void;
  onCreated: () => void;
  showToast: (text: string, type: 'success' | 'error') => void;
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
  background: 'var(--axi-primary-hover, #3b82f6)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'white',
  fontWeight: 600,
};

export default function CreateDeviceDialog({
  open,
  form,
  onChange,
  onCancel,
  onCreated,
  showToast,
}: CreateDeviceDialogProps) {
  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.sequence_num.trim()) {
      showToast('设备编号不能为空', 'error');
      return;
    }
    try {
      await apiClient.createDevice({
        sequence_num: form.sequence_num.trim(),
        display_name: form.display_name.trim(),
        device_group: form.device_group.trim() || inferDeviceGroupFromSequence(form.sequence_num.trim()),
        assigned_job: form.assigned_job.trim(),
        device_password: form.device_password.trim() || '123456',
      });
      onCreated();
      showToast('设备已创建，等待展示端首次登录绑定', 'success');
    } catch (e) {
      showToast('创建设备失败: ' + (e as Error).message, 'error');
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
          minWidth: 360,
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>新增设备位</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          中控端先分配设备编号和密码，展示端首次登录时会自动绑定到当前设备。产线分组留空时会按设备编号自动识别。
        </p>
        <input
          type="text"
          value={form.sequence_num}
          onChange={e =>
            onChange({
              ...form,
              sequence_num: e.target.value,
              device_group: (() => {
                const nextSequence = e.target.value;
                const prevDerivedGroup = inferDeviceGroupFromSequence(form.sequence_num);
                const nextDerivedGroup = inferDeviceGroupFromSequence(nextSequence);
                const shouldSyncGroup = !form.device_group.trim() || form.device_group.trim() === prevDerivedGroup;
                return shouldSyncGroup ? nextDerivedGroup : form.device_group;
              })(),
            })
          }
          placeholder="设备编号，如 Line1-01"
          autoFocus
          style={inputStyle}
        />
        <input
          type="text"
          value={form.device_group}
          onChange={e => onChange({ ...form, device_group: e.target.value })}
          placeholder="产线分组，留空时按设备编号自动识别"
          style={inputStyle}
        />
        <input
          type="text"
          value={form.display_name}
          onChange={e => onChange({ ...form, display_name: e.target.value })}
          placeholder="显示名称，可选"
          style={inputStyle}
        />
        <input
          type="text"
          value={form.assigned_job}
          onChange={e => onChange({ ...form, assigned_job: e.target.value })}
          placeholder="固定显示作业，可选"
          style={inputStyle}
        />
        <input
          type="text"
          value={form.device_password}
          onChange={e => onChange({ ...form, device_password: e.target.value })}
          placeholder="设备密码，默认 123456"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} style={cancelButtonStyle}>
            取消
          </button>
          <button onClick={() => void handleSubmit()} style={confirmButtonStyle}>
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
