/**
 * Pure tab-list state helpers for the workbench admin shell.
 *
 * Inspired by:
 *  - Axi Todo task dashboard open-routes implementation (close/focus flow)
 *    (openRoutes-driven tab list with closable differentiation)
 *  - shared/axi-ui shell tab contract (close-left / close-right / close-other / close-all / pin)
 *    (close-left / close-right / close-other / close-all / pin operations)
 *
 * Contract:
 *  - Every helper is PURE: same input, same output, no mutation of `tabs`.
 *  - Side-effects (navigate, setActiveTab) are returned to the caller as
 *    `nextActive` so React can react to them in `useEffect` / `setState`.
 *  - `closable: false` is treated as PINNED and survives all close helpers.
 *  - When `tabs` is empty after an op, `nextActive === null` (the caller
 *    decides whether to fall back to the dashboard or to a 404).
 *
 * Tab identity is anchored to `key`. `path` mirrors `key` in the admin shell
 * (kept REQUIRED to match `@epap/ui`'s `TabItem` so consumers don't need
 * adapter-time casts).
 */

export interface TabItem {
  /** Stable tab identity. Equals the route path for the desktop admin shell. */
  key: string;
  /** Visible label. */
  label: string;
  /** Navigation target for `navigate()`. Mirrors `key` in the admin shell. */
  path: string;
  /** `false` ⇒ PINNED. Pinned tabs survive every close helper. */
  closable?: boolean;
}

export interface TabOpResult {
  tabs: TabItem[];
  /** Next active key, or `null` when the list is empty. */
  nextActive: string | null;
}

/** Default landing tab for an empty shell. */
export const HOME_TAB: TabItem = {
  key: '/admin/dashboard',
  label: '概览',
  path: '/admin/dashboard',
  closable: false,
};

/* -------------------------------------------------------------------------- */
/*                                open / focus                                */
/* -------------------------------------------------------------------------- */

/**
 * Open `path` if not already present; otherwise no-op.
 * Always activates the tab. `path` defaults to `key` for symmetry.
 */
export function openTab(
  tabs: TabItem[],
  tab: { key: string; label: string; path?: string },
): TabOpResult {
  if (tabs.some((t) => t.key === tab.key)) {
    return { tabs, nextActive: tab.key };
  }
  return {
    tabs: [
      ...tabs,
      { closable: true, path: tab.path ?? tab.key, ...tab },
    ],
    nextActive: tab.key,
  };
}

/**
 * Move focus to `key` without changing the list. Returns the input tabs
 * unchanged; provided so callers can dispatch tab changes through the same
 * reducer-shaped pipeline.
 */
export function focusTab(tabs: TabItem[], key: string): TabOpResult {
  return { tabs, nextActive: key };
}

/* -------------------------------------------------------------------------- */
/*                                  close                                    */
/* -------------------------------------------------------------------------- */

/**
 * Close one tab by `key`.
 * If the closed tab was active, the new active is the LAST remaining tab
 * (matches Workbench UX). Returns `nextActive: null` when the list is empty
 * after the close.
 */
export function closeTab(tabs: TabItem[], key: string, activeKey: string): TabOpResult {
  const newTabs = tabs.filter((t) => t.key !== key);
  if (activeKey !== key) {
    return { tabs: newTabs, nextActive: activeKey };
  }
  if (newTabs.length === 0) {
    return { tabs: newTabs, nextActive: null };
  }
  return {
    tabs: newTabs,
    nextActive: newTabs[newTabs.length - 1].key,
  };
}

/** Close every tab strictly LEFT of active. Pinned tabs are kept. */
export function closeLeft(tabs: TabItem[], activeKey: string): TabOpResult {
  const idx = tabs.findIndex((t) => t.key === activeKey);
  if (idx <= 0) return { tabs, nextActive: activeKey };
  return {
    tabs: tabs.filter((t, i) => i >= idx || t.closable === false),
    nextActive: activeKey,
  };
}

/** Close every tab strictly RIGHT of active. Pinned tabs are kept. */
export function closeRight(tabs: TabItem[], activeKey: string): TabOpResult {
  const idx = tabs.findIndex((t) => t.key === activeKey);
  if (idx < 0 || idx === tabs.length - 1) {
    return { tabs, nextActive: activeKey };
  }
  return {
    tabs: tabs.filter((t, i) => i <= idx || t.closable === false),
    nextActive: activeKey,
  };
}

/** Close every tab that is NOT active AND NOT pinned. */
export function closeOther(tabs: TabItem[], activeKey: string): TabOpResult {
  return {
    tabs: tabs.filter((t) => t.key === activeKey || t.closable === false),
    nextActive: activeKey,
  };
}

/**
 * Close every CLOSABLE tab; pinned ones survive.
 * If any pinned tabs survive, next active is the LAST pinned tab.
 * Otherwise `nextActive` is `null`.
 */
export function closeAll(tabs: TabItem[]): TabOpResult {
  const pinned = tabs.filter((t) => t.closable === false);
  if (pinned.length === 0) {
    return { tabs: pinned, nextActive: null };
  }
  return {
    tabs: pinned,
    nextActive: pinned[pinned.length - 1].key,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    pin                                    */
/* -------------------------------------------------------------------------- */

/**
 * Flip `closable` for `key`. A pinned tab becomes closable and vice versa.
 * List order is preserved so the tab stays in place instead of jumping to
 * the end.
 */
export function togglePin(tabs: TabItem[], key: string): TabItem[] {
  return tabs.map((t) =>
    t.key === key
      ? { ...t, closable: t.closable === false ? true : false }
      : t,
  );
}
