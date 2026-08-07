/**
 * Bottom-nav badge API client.
 * GET /api/v1/notifications/nav-badges → { home, projects, workspace, me, unreadTotal }
 */

export type BadgeKind = 'none' | 'dot' | 'count';

export type NavBadgeDto = {
  kind: BadgeKind | string;
  value?: number;
};

export type NavBadgesResponse = {
  home: NavBadgeDto;
  projects: NavBadgeDto;
  workspace: NavBadgeDto;
  me: NavBadgeDto;
  unreadTotal?: number;
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

const TOKEN_KEY = 'epap_auth_token';
const USER_KEY = 'epap_user';

function dtoToBadge(dto?: NavBadgeDto): NavBadge {
  if (!dto) return { kind: 'none' };
  const kind = String(dto.kind || 'none').toLowerCase();
  if (kind === 'dot') return { kind: 'dot' };
  if (kind === 'count') {
    const value = Number(dto.value) || 0;
    return value > 0 ? { kind: 'count', value } : { kind: 'none' };
  }
  return { kind: 'none' };
}

function resolveUserId(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const user = JSON.parse(raw) as { id?: string; email?: string };
      if (user?.id && user.id !== '1') return String(user.id);
      // Seed inbox is scoped to demo; map default local user to demo seed.
      if (user?.email?.startsWith('demo')) return 'demo';
    }
  } catch {
    /* ignore */
  }
  return 'demo';
}

/**
 * Fetch bottom-tab badges from notification-service (via gateway / Vite proxy).
 */
export async function fetchNavBadges(signal?: AbortSignal): Promise<TabBadges> {
  const userId = resolveUserId();
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-User-Id': userId,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `/api/v1/notifications/nav-badges?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { headers, signal, credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`nav-badges HTTP ${res.status}`);
  }
  const data = (await res.json()) as NavBadgesResponse;
  return {
    home: dtoToBadge(data.home),
    projects: dtoToBadge(data.projects),
    workspace: dtoToBadge(data.workspace),
    me: dtoToBadge(data.me),
  };
}
