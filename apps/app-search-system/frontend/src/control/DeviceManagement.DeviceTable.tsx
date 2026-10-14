/**
 * DeviceManagement.DeviceTable —— 设备表格(表头 + 行渲染 + inline 编辑 + 密码修改)。
 * 从原 DeviceManagement.tsx 中抽出,保留原视图与交互。
 */
import React, { useState } from 'react';
import apiClient from '../shared/api/client';
import { getDeviceStatusMeta, isDeviceConnected } from '../shared/deviceStatus';

import { EditForm, inferDeviceGroupFromSequence, formatTime } from './DeviceManagement.utils';

interface DeviceTableProps {
  devices: Device[];
  deviceNames: Map<number, string>;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  maximized: boolean;
  editingId: number | null;
  editForm: EditForm;
  onEditFormChange: React.Dispatch<React.SetStateAction<EditForm>>;
  onStartEdit: (d: Device) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRefetch: () => void;
  showToast: (text: string, type: 'success' | 'error') => void;
}

export default function DeviceTable({
  devices,
  deviceNames,
  selected,
  onToggleSelect,
  maximized,
  editingId,
  editForm,
  onEditFormChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRefetch,
  showToast,
}: DeviceTableProps) {
  const [editingPasswordId, setEditingPasswordId] = useState<number | null>(null);
  const [editingPassword, setEditingPassword] = useState('');

  const savePassword = async (id: number) => {
    if (!editingPassword.trim()) {
      showToast('密码不能为空', 'error');
      return;
    }
    try {
      await apiClient.updateDevicePassword(id, editingPassword.trim());
      setEditingPasswordId(null);
      setEditingPassword('');
      showToast('密码修改成功', 'success');
      onRefetch();
    } catch (e) {
      showToast('修改失败: ' + (e as Error).message, 'error');
    }
  };

  const th = (label: string) => (
    <th
      style={{
        padding: '8px 10px',
        textAlign: 'center',
        borderTop: '1px solid var(--border)',
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: 'none',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        fontSize: 13,
        background: 'var(--bg-tertiary)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </th>
  );

  const tdStyle: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'center',
    borderTop: 'none',
    border: '1px solid var(--border)',
  };

  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 4px',
    fontSize: 13,
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <colgroup>
          <col />
          {maximized && <col />}
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr style={{ background: 'var(--bg-tertiary)', borderBottom: 'none' }}>
            {th('勾选')}
            {maximized && th('最近在线')}
            {th('产线')}
            {th('设备编号')}
            {th('状态')}
            {th('UUID')}
            {th('设备密码')}
            {th('操作')}
          </tr>
        </thead>
        <tbody>
          {devices.map(d => {
            const statusMeta = getDeviceStatusMeta(d.status);
            const isConnected = isDeviceConnected(d.status);
            return (
              <tr
                key={d.id}
                style={{
                  background: selected.has(d.id) ? 'var(--accent-light)' : 'transparent',
                }}
              >
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => onToggleSelect(d.id)}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                </td>
                {maximized && (
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {formatTime(d.last_seen || '')}
                    </span>
                  </td>
                )}
                <td style={tdStyle}>
                  {editingId === d.id ? (
                    <input
                      value={editForm.device_group}
                      onChange={e => onEditFormChange(f => ({ ...f, device_group: e.target.value }))}
                      placeholder={inferDeviceGroupFromSequence(editForm.sequence_num) || undefined}
                      style={cellInputStyle}
                    />
                  ) : d.device_group ? (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 8px',
                        background: 'var(--accent)',
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {d.device_group}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {editingId === d.id ? (
                    <input
                      value={editForm.sequence_num}
                      onChange={e =>
                        onEditFormChange(f => {
                          const nextSequence = e.target.value;
                          const prevDerivedGroup = inferDeviceGroupFromSequence(f.sequence_num);
                          const nextDerivedGroup = inferDeviceGroupFromSequence(nextSequence);
                          const shouldSyncGroup =
                            !f.device_group.trim() ||
                            f.device_group.trim() === prevDerivedGroup;
                          return {
                            ...f,
                            sequence_num: nextSequence,
                            device_group: shouldSyncGroup ? nextDerivedGroup : f.device_group,
                          };
                        })
                      }
                      style={cellInputStyle}
                    />
                  ) : (
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {deviceNames.get(d.id) || '—'}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusMeta.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: statusMeta.color,
                        fontWeight: 600,
                        opacity: isConnected ? 1 : 0.9,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  </span>
                </td>
                <td style={tdStyle}>
                  {(d.uuid || '').startsWith('pending:') ? (
                    <span style={{ fontSize: 12, color: 'var(--axi-text-muted, #94a3b8)' }}>
                      待绑定
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: 'var(--axi-text-muted, #64748b)',
                      }}
                      title={d.uuid}
                    >
                      {d.uuid.slice(0, 12)}…
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  {maximized && editingPasswordId === d.id ? (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <input
                        value={editingPassword}
                        onChange={e => setEditingPassword(e.target.value)}
                        placeholder="新密码"
                        autoFocus
                        style={{
                          width: 80,
                          padding: '2px 6px',
                          fontSize: 12,
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        onClick={() => void savePassword(d.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: 12,
                          background: 'var(--accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        确定
                      </button>
                      <button
                        onClick={() => {
                          setEditingPasswordId(null);
                          setEditingPassword('');
                        }}
                        style={{
                          padding: '2px 6px',
                          fontSize: 12,
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: d.device_password
                            ? 'var(--axi-warning, #f59e0b)'
                            : 'var(--text-secondary)',
                        }}
                      >
                        {d.device_password || '—'}
                      </span>
                      {maximized && (
                        <button
                          onClick={() => {
                            setEditingPasswordId(d.id);
                            setEditingPassword('');
                          }}
                          style={{
                            padding: '1px 6px',
                            fontSize: 11,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                          }}
                        >
                          修改
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  {editingId === d.id ? (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={onSaveEdit}
                        style={{
                          padding: '2px 8px',
                          fontSize: 12,
                          background: 'var(--accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={onCancelEdit}
                        style={{
                          padding: '2px 8px',
                          fontSize: 12,
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onStartEdit(d)}
                      style={{
                        padding: '2px 8px',
                        fontSize: 12,
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      编辑
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {devices.length === 0 && (
            <tr>
              <td
                colSpan={maximized ? 8 : 7}
                style={{
                  padding: '40px 12px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                }}
              >
                暂无设备
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
