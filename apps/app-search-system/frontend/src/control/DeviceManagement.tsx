/**
 * 设备管理页面 - 设备元数据管理
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../shared/api/client';
import { getDeviceStatusMeta, isDeviceConnected } from '../shared/deviceStatus';

interface EditForm {
  device_group: string;
  sequence_num: string;
  assigned_job: string;
}

interface CreateForm {
  display_name: string;
  device_group: string;
  sequence_num: string;
  assigned_job: string;
  device_password: string;
}

interface BatchCreateDraft {
  sequence_num: string;
  display_name: string;
  device_group: string;
  assigned_job: string;
  device_password: string;
}

interface Props {
  maximized?: boolean;
}

function parseSequenceNum(sequenceNum = ''): { line: number; device: number } | null {
  const match = sequenceNum.match(/^Line(\d+)-(\d+)$/i);
  if (!match) return null;
  return {
    line: Number(match[1]),
    device: Number(match[2]),
  };
}

function inferDeviceGroupFromSequence(sequenceNum = ''): string {
  const parsed = parseSequenceNum(sequenceNum.trim());
  return parsed ? `Line${parsed.line}` : '';
}

function sortDevicesForDisplay(a: Device, b: Device): number {
  const aSeq = parseSequenceNum(a.sequence_num || '');
  const bSeq = parseSequenceNum(b.sequence_num || '');

  if (aSeq && bSeq) {
    if (aSeq.line !== bSeq.line) return aSeq.line - bSeq.line;
    if (aSeq.device !== bSeq.device) return aSeq.device - bSeq.device;
  }

  if ((a.device_group || '') !== (b.device_group || '')) {
    if (!a.device_group) return 1;
    if (!b.device_group) return -1;
    return (a.device_group || '').localeCompare(b.device_group || '', 'zh-CN', { numeric: true });
  }

  return a.id - b.id;
}

function buildBatchCreateDrafts(batchText: string, defaultPassword: string): { devices: BatchCreateDraft[]; total: number } {
  const rows = batchText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const devices: BatchCreateDraft[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const compact = row.replace(/\s+/g, '');
    const match = compact.match(/^(?:Line)?(\d+)(?:[:=,，xX*])(\d+)$/i);
    if (!match) {
      throw new Error(`格式错误: ${row}。请使用“1=8”或“Line1=8”`);
    }

    const lineNumber = Number(match[1]);
    const count = Number(match[2]);
    if (!Number.isInteger(lineNumber) || lineNumber <= 0) {
      throw new Error(`产线号无效: ${row}`);
    }
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`设备数量无效: ${row}`);
    }

    const group = `Line${lineNumber}`;
    const width = Math.max(2, String(count).length);
    for (let i = 1; i <= count; i++) {
      const sequence_num = `${group}-${String(i).padStart(width, '0')}`;
      const key = sequence_num.toLowerCase();
      if (seen.has(key)) {
        throw new Error(`批量配置中存在重复设备编号: ${sequence_num}`);
      }
      seen.add(key);
      devices.push({
        sequence_num,
        display_name: sequence_num,
        device_group: group,
        assigned_job: '',
        device_password: defaultPassword.trim() || '123456',
      });
    }
  }

  return { devices, total: devices.length };
}

function buildInstallSheetText(devices: Device[]): string {
  const sorted = [...devices].sort(sortDevicesForDisplay);
  const lines: string[] = [
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `设备数量：${sorted.length}`,
    '',
  ];

  let currentGroup = '';
  for (const device of sorted) {
    const group = device.device_group || '未分组';
    if (group !== currentGroup) {
      if (currentGroup) lines.push('');
      lines.push(`[${group}]`);
      currentGroup = group;
    }

    const statusLabel = getDeviceStatusMeta(device.status).label;
    const bindLabel = (device.uuid || '').startsWith('pending:') ? '待绑定' : '已绑定';
    const parts = [
      device.sequence_num || '—',
      `密码 ${device.device_password || '—'}`,
      bindLabel,
      statusLabel,
    ];
    if (device.assigned_jobs) {
      parts.push(`固定作业 ${device.assigned_jobs}`);
    }
    lines.push(parts.join(' | '));
  }

  return lines.join('\n');
}

export default function DeviceManagement({ maximized = false }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ device_group: '', sequence_num: '', assigned_job: '' });
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
  const [editingPasswordId, setEditingPasswordId] = useState<number | null>(null);
  const [editingPassword, setEditingPassword] = useState('');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const devs = await apiClient.getDevices({ includeOffline: true }) as Device[];
      devs.sort(sortDevicesForDisplay);
      setDevices(devs || []);
      const gs = await apiClient.getDeviceGroups() as string[];
      setGroups(gs || []);
    } catch (e) {
      showToast('加载失败: ' + (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // 过滤后的设备列表（显示全部设备，不区分状态）
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

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(d => d.id)));
    }
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
        device_group: editForm.device_group.trim() || inferDeviceGroupFromSequence(editForm.sequence_num.trim()),
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

  const batchPreview = useMemo(() => {
    if (!batchCreateText.trim()) {
      return { total: 0, preview: [] as string[], error: '' };
    }

    try {
      const { devices: batchDevices, total } = buildBatchCreateDrafts(batchCreateText, batchCreatePassword);
      return {
        total,
        preview: batchDevices.slice(0, 8).map(item => item.sequence_num),
        error: '',
      };
    } catch (e) {
      return {
        total: 0,
        preview: [] as string[],
        error: (e as Error).message,
      };
    }
  }, [batchCreatePassword, batchCreateText]);

  const installSheetText = useMemo(() => buildInstallSheetText(filtered), [filtered]);

  const formatTime = (ts: string) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diff < 60) return `${diff}秒前`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const handleBatchCreate = async () => {
    let draft;
    try {
      draft = buildBatchCreateDrafts(batchCreateText, batchCreatePassword);
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
      setBatchCreateDialogOpen(false);
      setBatchCreateText('');
      showToast(`已批量创建 ${draft.total} 台设备位`, 'success');
      void fetchAll();
    } catch (e) {
      showToast('批量创建失败: ' + (e as Error).message, 'error');
    }
  };

  const handleCopyInstallSheet = async () => {
    try {
      await navigator.clipboard.writeText(installSheetText);
      showToast(`已复制 ${filtered.length} 台设备的安装清单`, 'success');
    } catch (e) {
      showToast('复制失败: ' + (e as Error).message, 'error');
    }
  };

  const selectedConnected = filtered.filter(d => isDeviceConnected(d.status)).length;

  // 按注册顺序自动编号
  const deviceNames = new Map<number, string>();
  for (const group of [...new Set(devices.map(d => d.device_group).filter(Boolean))]) {
    const groupDevs = devices.filter(d => d.device_group === group).sort((a, b) => a.id - b.id);
    let seq = 1;
    for (const d of groupDevs) {
      if (d.sequence_num) deviceNames.set(d.id, d.sequence_num);
      else { deviceNames.set(d.id, `${group}-${seq}`); seq++; }
    }
  }

  const th = (label: string, last?: boolean) => (
    <th style={{
      padding: '8px 10px', textAlign: 'center',
      borderTop: '1px solid var(--border)',
      borderLeft: '1px solid var(--border)',
      borderRight: '1px solid var(--border)',
      borderBottom: 'none',
      color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13,
      background: 'var(--bg-tertiary)', whiteSpace: 'nowrap',
    }}>
      {label}
    </th>
  );

  const td = (children: React.ReactNode, opts?: { bold?: boolean; color?: string; monospace?: boolean; first?: boolean; last?: boolean }) => (
    <td style={{
      padding: '6px 10px', textAlign: 'center',
      border: opts?.first ? '1px solid var(--border)' : opts?.last ? '1px solid var(--border)' : '1px solid var(--border)',
      borderTop: 'none',
      color: opts?.color || 'var(--text-primary)',
      fontSize: 13, fontWeight: opts?.bold ? 600 : 400,
      fontFamily: opts?.monospace ? 'monospace' : undefined,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </td>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 60, right: 24, zIndex: 9999,
          padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          color: 'white', maxWidth: 360,
          background: toastMsg.type === 'success' ? 'var(--axi-success, #22c55e)' : 'var(--axi-danger, #ef4444)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* 工具栏 */}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg-secondary)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          已选 {selected.size} 台（已连接 {selectedConnected} 台 / 共 {filtered.length} 台）
        </span>

        {/* 产线筛选 */}
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
          <option value="">全部产线</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        {/* 统一修改密码 */}
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
          style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 6, color: '#60a5fa', fontWeight: 600 }}>
          新增设备
        </button>

        <button
          onClick={() => {
            setBatchCreatePassword('123456');
            setBatchCreateText('');
            setBatchCreateDialogOpen(true);
          }}
          style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, color: '#34d399', fontWeight: 600 }}>
          批量生成
        </button>

        <button
          onClick={() => { setBatchPwdDialogOpen(true); setBatchPwd(''); }}
          style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, color: 'var(--axi-warning, #f59e0b)', fontWeight: 600 }}>
          统一修改密码
        </button>

        {createDialogOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '24px 28px', minWidth: 360, maxWidth: 460,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>新增设备位</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                中控端先分配设备编号和密码，展示端首次登录时会自动绑定到当前设备。产线分组留空时会按设备编号自动识别。
              </p>
                  <input
                type="text"
                value={createForm.sequence_num}
                onChange={e => setCreateForm(f => {
                  const nextSequence = e.target.value;
                  const prevDerivedGroup = inferDeviceGroupFromSequence(f.sequence_num);
                  const nextDerivedGroup = inferDeviceGroupFromSequence(nextSequence);
                  const shouldSyncGroup = !f.device_group.trim() || f.device_group.trim() === prevDerivedGroup;
                  return {
                    ...f,
                    sequence_num: nextSequence,
                    device_group: shouldSyncGroup ? nextDerivedGroup : f.device_group,
                  };
                })}
                placeholder="设备编号，如 Line1-01"
                autoFocus
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={createForm.device_group}
                onChange={e => setCreateForm(f => ({ ...f, device_group: e.target.value }))}
                placeholder="产线分组，留空时按设备编号自动识别"
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={createForm.display_name}
                onChange={e => setCreateForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="显示名称，可选"
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={createForm.assigned_job}
                onChange={e => setCreateForm(f => ({ ...f, assigned_job: e.target.value }))}
                placeholder="固定显示作业，可选"
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={createForm.device_password}
                onChange={e => setCreateForm(f => ({ ...f, device_password: e.target.value }))}
                placeholder="设备密码，默认 123456"
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setCreateDialogOpen(false)}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (!createForm.sequence_num.trim()) {
                      showToast('设备编号不能为空', 'error');
                      return;
                    }
                    try {
                      await apiClient.createDevice({
                        sequence_num: createForm.sequence_num.trim(),
                        display_name: createForm.display_name.trim(),
                        device_group: createForm.device_group.trim() || inferDeviceGroupFromSequence(createForm.sequence_num.trim()),
                        assigned_job: createForm.assigned_job.trim(),
                        device_password: createForm.device_password.trim() || '123456',
                      });
                      setCreateDialogOpen(false);
                      showToast('设备已创建，等待展示端首次登录绑定', 'success');
                      void fetchAll();
                    } catch (e) {
                      showToast('创建设备失败: ' + (e as Error).message, 'error');
                    }
                  }}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--axi-primary-hover, #3b82f6)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {batchCreateDialogOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '24px 28px', minWidth: 420, maxWidth: 560,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>批量生成设备位</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                每行填写一条产线和设备数量，系统会自动生成 `LineX-01` 这样的设备编号，并把产线分组设为 `LineX`。
              </p>
              <textarea
                value={batchCreateText}
                onChange={e => setBatchCreateText(e.target.value)}
                placeholder={'示例：\n1=8\n2=7\n3=9\n\n表示生成 Line1 的 8 台、Line2 的 7 台、Line3 的 9 台'}
                autoFocus
                rows={10}
                style={{ width: '100%', resize: 'vertical', padding: '10px 12px', fontSize: 13, lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={batchCreatePassword}
                onChange={e => setBatchCreatePassword(e.target.value)}
                placeholder="默认设备密码，默认 123456"
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {batchPreview.error ? (
                  <span style={{ color: '#f87171' }}>{batchPreview.error}</span>
                ) : batchPreview.total > 0 ? (
                  <span>
                    将创建 <strong style={{ color: 'var(--text-primary)' }}>{batchPreview.total}</strong> 台设备。
                    {batchPreview.preview.length > 0 ? ` 预览：${batchPreview.preview.join('、')}${batchPreview.total > batchPreview.preview.length ? ' ...' : ''}` : ''}
                  </span>
                ) : (
                  <span>支持格式：`1=8`、`Line1=8`、`2,12`。</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setBatchCreateDialogOpen(false)}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  取消
                </button>
                <button
                  onClick={() => {
                    setBatchCreateText(Array.from({ length: 17 }, (_, index) => `${index + 1}=`).join('\n'));
                  }}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  生成17线模板
                </button>
                <button
                  onClick={() => void handleBatchCreate()}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--axi-success, #10b981)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                  批量创建
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 批量修改密码弹窗 */}
        {batchPwdDialogOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '24px 28px', minWidth: 320, maxWidth: 400,
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary)' }}>统一修改所有设备密码</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                将所有 {filtered.length} 台设备的密码统一修改为：
              </p>
              <input
                type="text"
                value={batchPwd}
                onChange={e => setBatchPwd(e.target.value)}
                placeholder="输入新密码"
                autoFocus
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setBatchPwdDialogOpen(false)}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (!batchPwd.trim()) { void showToast('密码不能为空', 'error'); return; }
                    try {
                      await apiClient.updateAllDevicesPassword(batchPwd.trim());
                      setBatchPwdDialogOpen(false);
                      void showToast('密码已统一修改', 'success');
                      void fetchAll();
                    } catch (e) { void showToast('修改失败: ' + (e as Error).message, 'error'); }
                  }}
                  style={{ padding: '6px 16px', fontSize: 13, background: 'var(--axi-warning, #f59e0b)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                  确认修改
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setSheetDialogOpen(true)}
            style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
            安装清单
          </button>
          <button onClick={() => void fetchAll()}
            style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
            刷新
          </button>
        </div>
      </div>

      {sheetDialogOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '24px 28px', minWidth: 460, maxWidth: 760, width: '70vw',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>安装清单</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              当前清单基于系统内设备数据生成，不依赖外部 xlsx/csv。你可以按产线筛选后再打开这里复制给安装人员。
            </p>
            <textarea
              readOnly
              value={installSheetText}
              rows={18}
              style={{ width: '100%', resize: 'vertical', padding: '10px 12px', fontSize: 13, lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => void handleCopyInstallSheet()}
                style={{ padding: '6px 16px', fontSize: 13, background: 'var(--axi-primary-hover, #3b82f6)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                复制清单
              </button>
              <button
                onClick={() => setSheetDialogOpen(false)}
                style={{ padding: '6px 16px', fontSize: 13, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)' }}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 表格 */}
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
              {th('操作', true)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const statusMeta = getDeviceStatusMeta(d.status);
              const isConnected = isDeviceConnected(d.status);
              return (
                <tr key={d.id} style={{ background: selected.has(d.id) ? 'var(--accent-light)' : 'transparent' }}>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={selected.has(d.id)}
                      onChange={() => toggleSelect(d.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  </td>
                  {maximized && (
                    <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(d.last_seen || '')}</span>
                    </td>
                  )}
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    {editingId === d.id ? (
                      <input value={editForm.device_group}
                        onChange={e => setEditForm(f => ({ ...f, device_group: e.target.value }))}
                        placeholder={inferDeviceGroupFromSequence(editForm.sequence_num) || undefined}
                        style={{ width: '100%', padding: '2px 4px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    ) : d.device_group ? (
                      <span style={{ display: 'inline-block', padding: '1px 8px', background: 'var(--accent)', color: 'white', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>{d.device_group}</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    {editingId === d.id ? (
                      <input value={editForm.sequence_num}
                        onChange={e => setEditForm(f => {
                          const nextSequence = e.target.value;
                          const prevDerivedGroup = inferDeviceGroupFromSequence(f.sequence_num);
                          const nextDerivedGroup = inferDeviceGroupFromSequence(nextSequence);
                          const shouldSyncGroup = !f.device_group.trim() || f.device_group.trim() === prevDerivedGroup;
                          return {
                            ...f,
                            sequence_num: nextSequence,
                            device_group: shouldSyncGroup ? nextDerivedGroup : f.device_group,
                          };
                        })}
                        style={{ width: '100%', padding: '2px 4px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{deviceNames.get(d.id) || '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusMeta.color, flexShrink: 0 }} />
                      <span style={{ color: statusMeta.color, fontWeight: 600, opacity: isConnected ? 1 : 0.9 }}>
                        {statusMeta.label}
                      </span>
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    {(d.uuid || '').startsWith('pending:') ? (
                      <span style={{ fontSize: 12, color: 'var(--axi-text-muted, #94a3b8)' }}>待绑定</span>
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--axi-text-muted, #64748b)' }} title={d.uuid}>{d.uuid.slice(0, 12)}…</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    {maximized && editingPasswordId === d.id ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <input
                          value={editingPassword}
                          onChange={e => setEditingPassword(e.target.value)}
                          placeholder="新密码"
                          autoFocus
                          style={{ width: 80, padding: '2px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                        />
                        <button
                          onClick={async () => {
                            if (!editingPassword.trim()) { void showToast('密码不能为空', 'error'); return; }
                            try {
                              await apiClient.updateDevicePassword(d.id, editingPassword.trim());
                              setEditingPasswordId(null);
                              setEditingPassword('');
                              void showToast('密码修改成功', 'success');
                              void fetchAll();
                            } catch (e) { void showToast('修改失败: ' + (e as Error).message, 'error'); }
                          }}
                          style={{ padding: '2px 6px', fontSize: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                          确定
                        </button>
                        <button
                          onClick={() => { setEditingPasswordId(null); setEditingPassword(''); }}
                          style={{ padding: '2px 6px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)' }}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: d.device_password ? 'var(--axi-warning, #f59e0b)' : 'var(--text-secondary)' }}>
                          {d.device_password || '—'}
                        </span>
                        {maximized && (
                          <button
                            onClick={() => { setEditingPasswordId(d.id); setEditingPassword(''); }}
                            style={{ padding: '1px 6px', fontSize: 11, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)' }}>
                            修改
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', borderTop: 'none', border: '1px solid var(--border)' }}>
                    {editingId === d.id ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={saveEdit} style={{ padding: '2px 8px', fontSize: 12, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>保存</button>
                        <button onClick={cancelEdit} style={{ padding: '2px 8px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)' }}>取消</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(d)} style={{ padding: '2px 8px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)' }}>编辑</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={maximized ? 8 : 7} style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderTop: 'none' }}>
                  暂无设备
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
