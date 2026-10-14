import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";

import type { NavRouteKey } from "../../app-registry";
import { normalizeTabKeys } from "../../tab-state";

/**
 * Tabs region: owns the route-tab close/pin handlers used by the shell tabbar.
 * The handlers are moved verbatim from the shell entry. `closeTab` and
 * `closeOtherTabs` are the two currently wired to `AxiDashboardShell` props;
 * the remaining tab-menu handlers are preserved as-is.
 */
export function makeShellTabHandlers({
  navigate,
  pinnedTabKeySet,
  pinnedTabKeys,
  selectedKey,
  setPinnedTabKeys,
  setVisitedTabKeys,
  visitedTabKeys
}: {
  navigate: NavigateFunction;
  pinnedTabKeySet: Set<NavRouteKey>;
  pinnedTabKeys: NavRouteKey[];
  selectedKey: NavRouteKey;
  setPinnedTabKeys: Dispatch<SetStateAction<NavRouteKey[]>>;
  setVisitedTabKeys: Dispatch<SetStateAction<NavRouteKey[]>>;
  visitedTabKeys: NavRouteKey[];
}) {
  function closeLeftTabs() {
    const activeIndex = visitedTabKeys.indexOf(selectedKey);
    if (activeIndex <= 0) return;
    setVisitedTabKeys((keys) => keys.filter((key, index) => index >= activeIndex || pinnedTabKeySet.has(key)));
  }

  function closeOtherTabs() {
    setVisitedTabKeys((keys) => normalizeTabKeys(keys.filter((key) => key === selectedKey || pinnedTabKeySet.has(key))));
  }

  function closeRightTabs() {
    const activeIndex = visitedTabKeys.indexOf(selectedKey);
    if (activeIndex < 0 || activeIndex >= visitedTabKeys.length - 1) return;
    setVisitedTabKeys((keys) => keys.filter((key, index) => index <= activeIndex || pinnedTabKeySet.has(key)));
  }

  function closeTab(key: NavRouteKey) {
    if (pinnedTabKeySet.has(key)) return;
    const nextKeys = visitedTabKeys.filter((item) => item !== key);
    const normalizedKeys: NavRouteKey[] = nextKeys.length ? nextKeys : ["/overview"];
    setVisitedTabKeys(normalizedKeys);

    if (key === selectedKey) {
      const closedIndex = visitedTabKeys.indexOf(key);
      navigate(normalizedKeys[Math.min(closedIndex, normalizedKeys.length - 1)] || "/overview");
    }
  }

  function closeAllTabs() {
    const nextKeys: NavRouteKey[] = pinnedTabKeys.length ? pinnedTabKeys : normalizeTabKeys(["/overview"]);
    setVisitedTabKeys(nextKeys);
    if (!nextKeys.includes(selectedKey)) {
      navigate(nextKeys[0] || "/overview", { replace: true });
    }
  }

  function togglePinTab(key: NavRouteKey) {
    setPinnedTabKeys((keys) => keys.includes(key) ? keys.filter((item) => item !== key) : normalizeTabKeys([...keys, key]));
    setVisitedTabKeys((keys) => normalizeTabKeys(keys.includes(key) ? keys : [...keys, key]));
  }

  return { closeAllTabs, closeLeftTabs, closeOtherTabs, closeRightTabs, closeTab, togglePinTab };
}
