import { WORKBENCH_SESSION_KEYS } from '@axi/workbench-foundation';

export type BadgeKind = 'none' | 'dot' | 'count';

type NavBadgeDto = {
  kind?: BadgeKind | string;
  value?: number;
};

type NavBadgesResponse = {
  home?: NavBadgeDto;
  projects?: NavBadgeDto;
  workspace?: NavBadgeDto;
  me?: NavBadgeDto;
};

export type NavBadge =
  | { kind: 'none' }
  | { kind: 'dot' }
  | { kind: 'count'; value: number };

export type TabBadges = {
  home: NavBadge;
  projects: NavBadge;
  workspace: NavBadge;
  me: NavBadge;
};

export const EMPTY_TAB_BADGES: TabBadges = {
  home: { kind: 'none' },
  projects: { kind: 'none' },
  workspace: { kind: 'none' },
  me: { kind: 'none' },
};

function toBadge(dto?: NavBadgeDto): NavBadge {
  const kind = String(dto?.kind || 'none').toLowerCase();
  if (kind === 'dot') return { kind: 'dot' };
  if (kind === 'count') {
    const value = Number(dto?.value) || 0;
    return value > 0 ? { kind: 'count', value } : { kind: 'none' };
  }
  return { kind: 'none' };
}

function currentUserId(): string {
  try {
    const raw = window.localStorage.getItem(WORKBENCH_SESSION_KEYS.user);
    const user = raw ? (JSON.parse(raw) as { id?: string; email?: string }) : null;
    if (user?.id && user.id !== '1') return String(user.id);
    if (user?.email?.startsWith('demo')) return 'demo';
  } catch {
    // 徽标失败不影响导航。
  }
  return 'demo';
}

/** 移动端独立拉取微信式角标；失败时保持无角标，而不是阻塞导航。 */
export async function fetchNavBadges(signal?: AbortSignal): Promise<TabBadges> {
  const token = window.localStorage.getItem(WORKBENCH_SESSION_KEYS.accessToken);
  const headers: Record<string, string> = { Accept: 'application/json', 'X-User-Id': currentUserId() };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/v1/notifications/nav-badges?userId=${encodeURIComponent(currentUserId())}`, {
    headers,
    signal,
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`nav-badges HTTP ${response.status}`);

  const data = (await response.json()) as NavBadgesResponse;
  return {
    home: toBadge(data.home),
    projects: toBadge(data.projects),
    workspace: toBadge(data.workspace),
    me: toBadge(data.me),
  };
}
