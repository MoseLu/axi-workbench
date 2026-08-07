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

/** 移动端独立拉取微信式角标；失败时保持无角标，而不是阻塞导航。 */
export async function fetchNavBadges(signal?: AbortSignal): Promise<TabBadges> {
  const response = await fetch(resolveGatewayURL('/api/v1/notifications/nav-badges'), {
    headers: { Accept: 'application/json' },
    signal,
    credentials: 'include',
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
import { resolveGatewayURL } from '@axi/workbench-foundation';
