import { useCallback, useEffect, useRef, useState } from 'react';
import { NOTIFICATIONS_CHANGED_EVENT } from '@axi/workbench-foundation';
import { EMPTY_TAB_BADGES, fetchNavBadges, type TabBadges } from '../lib/navBadges';

const POLL_INTERVAL = 30_000;

/** 与旧移动端一致：角标在前台与重新聚焦时刷新，失败时保留最后一次成功结果。 */
export function useNavBadges(enabled = true): TabBadges {
  const [badges, setBadges] = useState<TabBadges>(EMPTY_TAB_BADGES);
  const mounted = useRef(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchNavBadges(signal);
      if (mounted.current) setBadges(next);
    } catch {
      // 无网络或未登录时维持当前显示。
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return undefined;

    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onNotificationsChanged = () => void refresh();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
    return () => {
      mounted.current = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
    };
  }, [enabled, refresh]);

  return badges;
}
