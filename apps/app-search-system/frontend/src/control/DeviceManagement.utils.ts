/**
 * DeviceManagement 工具函数 / 共享类型
 * 从原 DeviceManagement.tsx 中抽离,保持纯逻辑。
 */
import { getDeviceStatusMeta } from '../shared/deviceStatus';

export interface EditForm {
  device_group: string;
  sequence_num: string;
  assigned_job: string;
}

export interface CreateForm {
  display_name: string;
  device_group: string;
  sequence_num: string;
  assigned_job: string;
  device_password: string;
}

export interface BatchCreateDraft {
  sequence_num: string;
  display_name: string;
  device_group: string;
  assigned_job: string;
  device_password: string;
}

export function parseSequenceNum(sequenceNum = ''): { line: number; device: number } | null {
  const match = sequenceNum.match(/^Line(\d+)-(\d+)$/i);
  if (!match) return null;
  return {
    line: Number(match[1]),
    device: Number(match[2]),
  };
}

export function inferDeviceGroupFromSequence(sequenceNum = ''): string {
  const parsed = parseSequenceNum(sequenceNum.trim());
  return parsed ? `Line${parsed.line}` : '';
}

export function sortDevicesForDisplay(a: Device, b: Device): number {
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

export function buildBatchCreateDrafts(
  batchText: string,
  defaultPassword: string
): { devices: BatchCreateDraft[]; total: number } {
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

export function buildInstallSheetText(devices: Device[]): string {
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

export function formatTime(ts: string): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}
