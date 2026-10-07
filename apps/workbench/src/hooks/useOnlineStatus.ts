import { useEffect, useState } from 'react';

/**
 * Track the browser online/offline state via the standard
 * `online`/`offline` window events plus the `navigator.onLine` initial hint.
 *
 * Defaults to `true` during SSR where `navigator` is undefined so server-rendered
 * markup does not flash an offline banner before the client hydration runs.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}