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
  unreadTotal: number;
};

export const EMPTY_TAB_BADGES: TabBadges = {
  home: { kind: 'none' },
  projects: { kind: 'none' },
  workspace: { kind: 'none' },
  me: { kind: 'none' },
  unreadTotal: 0,
};

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

/**
 * Fetch navigation badges through the gateway's HttpOnly Axi session.
 */
export async function fetchNavBadges(signal?: AbortSignal): Promise<TabBadges> {
  const res = await fetch('/api/v1/notifications/nav-badges', { headers: { Accept: 'application/json' }, signal, credentials: 'include' });
  if (!res.ok) {
    throw new Error(`nav-badges HTTP ${res.status}`);
  }
  const data = (await res.json()) as NavBadgesResponse;
  return {
    home: dtoToBadge(data.home),
    projects: dtoToBadge(data.projects),
    workspace: dtoToBadge(data.workspace),
    me: dtoToBadge(data.me),
    unreadTotal: Math.max(0, Math.trunc(Number(data.unreadTotal) || 0)),
  };
}
