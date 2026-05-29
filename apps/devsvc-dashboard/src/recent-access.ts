import { useEffect, useState } from "react";

import { isNavRouteKey, type NavRouteKey } from "./app-registry";

export type RecentAccessItem = {
  key: NavRouteKey;
  timestamp: number;
};

const recentAccessStorageKey = "devsvc-dashboard-recent-access";
const maxRecentAccessItems = 8;

function normalizeRecentAccess(items: RecentAccessItem[]): RecentAccessItem[] {
  const seen = new Set<NavRouteKey>();
  return items
    .filter((item) => item.key !== "/overview" && isNavRouteKey(item.key) && Number.isFinite(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, maxRecentAccessItems);
}

function readRecentAccess(): RecentAccessItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentAccessStorageKey) || "[]") as RecentAccessItem[];
    return normalizeRecentAccess(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function writeRecentAccess(items: RecentAccessItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(recentAccessStorageKey, JSON.stringify(items));
}

function commitRecentAccess(items: RecentAccessItem[], key: NavRouteKey): RecentAccessItem[] {
  if (key === "/overview") return normalizeRecentAccess(items);
  return normalizeRecentAccess([{ key, timestamp: Date.now() }, ...items]);
}

export function useRecentAccessTracker(activeKey: NavRouteKey) {
  const [recentAccess, setRecentAccess] = useState<RecentAccessItem[]>(() => readRecentAccess());

  useEffect(() => {
    setRecentAccess((current) => {
      const next = commitRecentAccess(current, activeKey);
      writeRecentAccess(next);
      return next;
    });
  }, [activeKey]);

  function addRecentAccess(key: NavRouteKey) {
    setRecentAccess((current) => {
      const next = commitRecentAccess(current, key);
      writeRecentAccess(next);
      return next;
    });
  }

  function clearRecentAccess() {
    setRecentAccess([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(recentAccessStorageKey);
    }
  }

  return { recentAccess, addRecentAccess, clearRecentAccess };
}
