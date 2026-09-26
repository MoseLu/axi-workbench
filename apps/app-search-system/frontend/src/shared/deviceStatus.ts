export type DeviceStatus = 'offline' | 'online' | 'logged_in';

export function normalizeDeviceStatus(status?: string): DeviceStatus {
  if (status === 'logged_in') return 'logged_in';
  if (status === 'online') return 'online';
  return 'offline';
}

export function isDeviceConnected(status?: string) {
  return normalizeDeviceStatus(status) !== 'offline';
}

export function getDeviceStatusMeta(status?: string) {
  const normalized = normalizeDeviceStatus(status);

  switch (normalized) {
    case 'logged_in':
      return { status: normalized, label: '已登录', color: 'var(--axi-success, #22c55e)' };
    case 'online':
      return { status: normalized, label: '在线', color: 'var(--axi-warning, #f59e0b)' };
    default:
      return { status: normalized, label: '离线', color: 'var(--axi-text-muted, #94a3b8)' };
  }
}
