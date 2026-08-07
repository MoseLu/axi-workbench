import type { AxiIconName } from '@axi/core';

/**
 * Product-level icon semantics shared by the independent Web and mobile
 * clients. Glyph data stays in `@axi/core`; the apps choose their own button,
 * tab, and touch-target presentation around these semantic names.
 */
export const axiWorkbenchIconMap = {
  account: 'user',
  add: 'plus',
  back: 'left',
  check: 'success',
  close: 'close',
  collapse: 'fold',
  database: 'admin-database',
  down: 'admin-caret-bottom',
  expand: 'expand',
  file: 'doc',
  focus: 'success',
  folder: 'folder',
  forward: 'right',
  fullscreen: 'expand-fullscreen',
  fullscreenExit: 'collapse-fullscreen',
  github: 'github',
  home: 'home',
  language: 'lang',
  laptop: 'admin-laptop',
  logout: 'admin-logout',
  menu: 'admin-menu',
  message: 'msg',
  mobile: 'admin-mobile',
  moon: 'dark',
  notification: 'notice',
  overview: 'admin-dashboard',
  project: 'admin-project',
  roles: 'admin-usergroup-add',
  scan: 'admin-scan',
  search: 'search',
  settings: 'settings',
  sun: 'light',
  tablet: 'admin-pad',
  team: 'team',
  trendDown: 'admin-arrow-down',
  trendUp: 'admin-arrow-up',
  upload: 'upload',
  workspace: 'workbench',
} as const satisfies Record<string, AxiIconName>;

export type AxiWorkbenchIconName = keyof typeof axiWorkbenchIconMap;

/** Resolve a product semantic icon name to the canonical Axi SVG asset. */
export function resolveAxiWorkbenchIcon(name: AxiWorkbenchIconName): AxiIconName {
  return axiWorkbenchIconMap[name];
}
