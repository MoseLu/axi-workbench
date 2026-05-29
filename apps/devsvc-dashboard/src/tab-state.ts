import { isNavRouteKey, type NavRouteKey } from "./app-registry";

const pinnedTabsStorageKey = "devsvc-dashboard-pinned-tabs";

export function normalizeTabKeys(keys: NavRouteKey[]): NavRouteKey[] {
  const seen = new Set<NavRouteKey>();
  return keys.filter((key) => {
    if (!isNavRouteKey(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readPinnedTabKeys(): NavRouteKey[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pinnedTabsStorageKey) || "[]") as unknown[];
    return normalizeTabKeys(parsed.filter(isNavRouteKey));
  } catch {
    return [];
  }
}

export function writePinnedTabKeys(keys: NavRouteKey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(pinnedTabsStorageKey, JSON.stringify(normalizeTabKeys(keys)));
}
