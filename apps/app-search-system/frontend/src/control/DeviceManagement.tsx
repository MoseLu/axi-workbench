/**
 * 设备管理页面 - 设备元数据管理
 *
 * 本文件是设备管理页面的主入口,负责:
 * - 设备列表状态、编辑、批量操作的状态管理
 * - 工具栏(产线筛选、新增/批量生成/批量改密/安装清单)
 * - 组合表格与各弹窗子组件
 *
 * 表格渲染拆到 DeviceManagement.DeviceTable。
 * 弹窗逻辑拆到:
 * - DeviceManagement.CreateDialog
 * - DeviceManagement.BatchCreateDialog
 * - DeviceManagement.PasswordDialog (BatchPasswordDialog + InstallSheetDialog)
 * 工具函数与共享类型拆到 DeviceManagement.utils。
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../shared/api/client';
import { isDeviceConnected } from '../shared/deviceStatus';

import {
  EditForm,
  CreateForm,
  inferDeviceGroupFromSequence,
  sortDevicesForDisplay,
  buildInstallSheetText,
} from './DeviceManagement.utils';
import CreateDeviceDialog from './DeviceManagement.CreateDialog';
import BatchCreateDialog from './DeviceManagement.BatchCreateDialog';
import {
  BatchPasswordDialog,
  InstallSheetDialog,
  generateInstallSheet,
} from './DeviceManagement.PasswordDialog';
import DeviceTable from './DeviceManagement.DeviceTable';

interface Props {
  maximized?: boolean;
}

export default function DeviceManagement({ maximized = false }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    device_group: '',
    sequence_num: '',
    assigned_job: '',
  });
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [batchPwdDialogOpen, setBatchPwdDialogOpen] = useState(false);
  const [batchPwd, setBatchPwd] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchCreateDialogOpen, setBatchCreateDialogOpen] = useState(false);
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    display_name: '',
    device_group: '',
    sequence_num: '',
    assigned_job: '',
    device_password: '123456',
  });
  const [batchCreateText, setBatchCreateText] = useState('');
  const [batchCreatePassword, setBatchCreatePassword] = useState('123456');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const devs = (await apiClient.getDevices({ includeOffline: true })) as Device[];
      devs.sort(sortDevicesForDisplay);
      setDevices(devs || []);
      const gs = (await apiClient.getDeviceGroups()) as string[];
      setGroups(gs || []);
    } catch (e) {
      showToast('加载失败: ' + (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filtered = devices.filter(d => {
    if (groupFilter && d.device_group !== groupFilter) return false;
    return true;
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (d: Device) => {
    setEditingId(d.id);
    setEditForm({
      device_group: d.device_group || '',
      sequence_num: d.sequence_num || '',
      assigned_job: d.assigned_jobs || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await apiClient.updateDevice(editingId, {
        device_group:
          editForm.device_group.trim() ||
          inferDeviceGroupFromSequence(editForm.sequence_num.trim()),
        sequence_num: editForm.sequence_num,
        assigned_job: editForm.assigned_job,
      });
      setEditingId(null);
      showToast('保存成功', 'success');
      void fetchAll();
    } catch (e) {
      showToast('保存失败: ' + (e as Error).message, 'error');
    }
  };

  const installSheetText = useMemo(() => buildInstallSheetText(filtered), [filtered]);

  const handleCopyInstallSheet = async () => {
    try {
      await navigator.clipboard.writeText(installSheetText);
      showToast(`已复制 ${filtered.length} 台设备的安装清单`, 'success');
    } catch (e) {
      showToast('复制失败: ' + (e as Error).message, 'error');
    }
  };

  const selectedConnected = filtered.filter(d => isDeviceConnected(d.status)).length;

  const deviceNames = new Map<number, string>();
  for (const group of [...new Set(devices.map(d => d.device_group).filter(Boolean))]) {
    const groupDevs = devices.filter(d => d.device_group === group).sort((a, b) => a.id - b.id);
    let seq = 1;
    for (const d of groupDevs) {
      if (d.sequence_num) deviceNames.set(d.id, d.sequence_num);
      else {
        deviceNames.set(d.id, `${group}-${seq}`);
        seq++;
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            right: 24,
            zIndex: 9999,
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            color: 'white',
            maxWidth: 360,
            background:
              toastMsg.type === 'success'
                ? 'var(--axi-success, #22c55e)'
                : 'var(--axi-danger, #ef4444)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
        >
          {toastMsg.text}
        </div>
      )}

      {/* 工具栏 */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          background: 'var(--bg-secondary)',
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          已选 {selected.size} 台（已连接 {selectedConnected} 台 / 共 {filtered.length} 台）
        </span>

        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">全部产线</option>
          {groups.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setCreateForm({
              display_name: '',
              device_group: groupFilter || '',
              sequence_num: '',
              assigned_job: '',
              device_password: '123456',
            });
            setCreateDialogOpen(true);
          }}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            background: 'color-mix(in srgb, var(--axi-primary, #3b82f6) 15%, transparent)',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 6,
            color: 'var(--axi-primary, #60a5fa)',
            fontWeight: 600,
          }}
        >
          新增设备
        </button>

        <button
          onClick={() => {
            setBatchCreatePassword('123456');
            setBatchCreateText('');
            setBatchCreateDialogOpen(true);
          }}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            background: 'color-mix(in srgb, var(--axi-success, #10b981) 15%, transparent)',
            border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: 6,
            color: 'var(--axi-success, #34d399)',
            fontWeight: 600,
          }}
        >
          批量生成
        </button>

        <button
          onClick={() => {
            setBatchPwdDialogOpen(true);
            setBatchPwd('');
          }}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 6,
            color: 'var(--axi-warning, #f59e0b)',
            fontWeight: 600,
          }}
        >
          统一修改密码
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSheetDialogOpen(true)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
          >
            安装清单
          </button>
          <button
            onClick={() => void fetchAll()}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
          >
            刷新
          </button>
        </div>
      </div>

      <CreateDeviceDialog
        open={createDialogOpen}
        form={createForm}
        onChange={setCreateForm}
        onCancel={() => setCreateDialogOpen(false)}
        onCreated={() => {
          setCreateDialogOpen(false);
          void fetchAll();
        }}
        showToast={showToast}
      />

      <BatchCreateDialog
        open={batchCreateDialogOpen}
        text={batchCreateText}
        onTextChange={setBatchCreateText}
        password={batchCreatePassword}
        onPasswordChange={setBatchCreatePassword}
        onCancel={() => setBatchCreateDialogOpen(false)}
        onCreated={() => {
          setBatchCreateDialogOpen(false);
          setBatchCreateText('');
          void fetchAll();
        }}
        showToast={showToast}
      />

      <BatchPasswordDialog
        open={batchPwdDialogOpen}
        password={batchPwd}
        onPasswordChange={setBatchPwd}
        onCancel={() => setBatchPwdDialogOpen(false)}
        totalDevices={filtered.length}
        showToast={showToast}
        onUpdated={() => {
          setBatchPwdDialogOpen(false);
          void fetchAll();
        }}
      />

      <InstallSheetDialog
        open={sheetDialogOpen}
        text={generateInstallSheet(filtered)}
        onCancel={() => setSheetDialogOpen(false)}
        onCopy={() => void handleCopyInstallSheet()}
      />

      {/* 表格 */}
      <DeviceTable
        devices={filtered}
        deviceNames={deviceNames}
        selected={selected}
        onToggleSelect={toggleSelect}
        maximized={maximized}
        editingId={editingId}
        editForm={editForm}
        onEditFormChange={setEditForm}
        onStartEdit={startEdit}
        onSaveEdit={() => void saveEdit()}
        onCancelEdit={cancelEdit}
        onRefetch={() => void fetchAll()}
        showToast={showToast}
      />
    </div>
  );
}
