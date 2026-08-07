import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_TAB_BADGES,
  fetchNavBadges,
  type TabBadges,
} from '../lib/navBadges';

const POLL_MS = 30_000;

/**
 * Poll notification-service for bottom-nav badges (WeChat-style count / red-dot).
 * Failures keep the last successful payload; first failure stays Empty.
 */
export function useNavBadges(enabled = true): TabBadges {
  const [badges, setBadges] = useState<TabBadges>(EMPTY_TAB_BADGES);
  const mounted = useRef(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchNavBadges(signal);
      if (mounted.current) setBadges(next);
    } catch {
      // keep last success / empty
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;

    const ac = new AbortController();
    void refresh(ac.signal);
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted.current = false;
      ac.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, refresh]);

  return badges;
}
