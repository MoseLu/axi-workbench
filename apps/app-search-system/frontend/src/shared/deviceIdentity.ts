const DISPLAY_CLIENT_UUID_KEY = 'sop_display_client_uuid';

function buildFallbackUuid() {
  return `display-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateDisplayClientUuid(): string {
  if (typeof window === 'undefined') return 'display-web';

  const existing = localStorage.getItem(DISPLAY_CLIENT_UUID_KEY)?.trim();
  if (existing) return existing;

  const legacyUuid = localStorage.getItem('sop_device_uuid')?.trim();
  const nextUuid = legacyUuid || window.crypto?.randomUUID?.() || buildFallbackUuid();
  localStorage.setItem(DISPLAY_CLIENT_UUID_KEY, nextUuid);
  return nextUuid;
}

export function getDisplayDeviceInfo(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};

  return {
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    platform: navigator.platform,
  };
}
