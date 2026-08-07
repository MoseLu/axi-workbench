export type MobileNavKey = 'home' | 'projects' | 'workspace' | 'scan' | 'me';

export const MOBILE_NAV_ITEMS: ReadonlyArray<{
  key: MobileNavKey;
  path: string;
  labelKey: 'nav.home' | 'nav.projects' | 'nav.workspace' | 'nav.scan' | 'nav.profile';
}> = [
  { key: 'home', path: '/home', labelKey: 'nav.home' },
  { key: 'projects', path: '/projects', labelKey: 'nav.projects' },
  { key: 'workspace', path: '/workspace', labelKey: 'nav.workspace' },
  { key: 'scan', path: '/scan', labelKey: 'nav.scan' },
  { key: 'me', path: '/me', labelKey: 'nav.profile' },
];

/**
 * 独立移动端延续既有微信式五项导航；旧的 focus 路径只作为兼容别名，
 * 不再把桌面后台的信息架构折叠到移动端中。
 */
export function resolveMobileNavKey(pathname: string): MobileNavKey {
  const path = pathname.replace(/\/+$/, '') || '/home';
  if (path === '/projects' || path.startsWith('/projects/')) return 'projects';
  if (path === '/workspace' || path.startsWith('/workspace/') || path === '/focus' || path.startsWith('/focus/')) return 'workspace';
  if (path === '/scan' || path.startsWith('/scan/')) return 'scan';
  if (path === '/me' || path.startsWith('/me/')) return 'me';
  return 'home';
}

export function mobilePageTitleKey(
  pathname: string,
): 'page.home' | 'page.search' | 'page.projects' | 'page.workspace' | 'page.scan' | 'page.inbox' | 'page.profile' {
  const path = pathname.replace(/\/+$/, '') || '/home';
  if (path === '/search') return 'page.search';
  if (path.startsWith('/projects')) return 'page.projects';
  if (path.startsWith('/workspace') || path.startsWith('/focus')) return 'page.workspace';
  if (path.startsWith('/scan')) return 'page.scan';
  if (path.startsWith('/inbox')) return 'page.inbox';
  if (path.startsWith('/me')) return 'page.profile';
  return 'page.home';
}
