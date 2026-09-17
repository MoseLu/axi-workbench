import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';

export type WorkbenchLocale = 'zh-CN' | 'en-US';

export const WORKBENCH_LOCALE_STORAGE_KEY = 'axi.workbench.locale';
const LEGACY_LOCALE_STORAGE_KEY = 'axi_portal_locale';

export interface WorkbenchLocaleContextValue {
  locale: WorkbenchLocale;
  setLocale: (next: WorkbenchLocale) => void;
}

const WorkbenchLocaleContext = createContext<WorkbenchLocaleContextValue | null>(null);

function readLocale(): WorkbenchLocale {
  if (typeof window === 'undefined') return 'zh-CN';
  const stored =
    window.localStorage.getItem(WORKBENCH_LOCALE_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  return stored === 'en-US' ? 'en-US' : 'zh-CN';
}

function isWorkbenchLocale(value: unknown): value is WorkbenchLocale {
  return value === 'zh-CN' || value === 'en-US';
}

export const WorkbenchLocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [locale, setLocaleState] = useState<WorkbenchLocale>(readLocale);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKBENCH_LOCALE_STORAGE_KEY, locale);
      // 兼容 Web 端既有持久化键，避免已有用户语言偏好被打断。
      window.localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, locale);
    } catch {
      // 存储被禁用时仍可在当前会话完成切换。
    }
    document.documentElement.lang = locale;
  }, [locale]);

  // Locale is a user preference, not an auth credential. Local storage remains
  // a fast offline cache; once the HttpOnly Axi session is available, the
  // canonical preference is read from and written to platform-core.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setRemoteReady(false);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const response = await fetch('/api/v1/me/preferences', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok || cancelled) return;
        const preference = (await response.json()) as { locale?: unknown };
        if (isWorkbenchLocale(preference.locale)) setLocaleState(preference.locale);
        if (!cancelled) setRemoteReady(true);
      } catch {
        // An unavailable preference service must not prevent a signed-in UI.
        if (!cancelled) setRemoteReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !remoteReady) return;
    void fetch('/api/v1/me/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ locale }),
    }).catch(() => {
      // The local cache remains valid if a transient preference write fails.
    });
  }, [isAuthenticated, locale, remoteReady]);

  const setLocale = useCallback((next: WorkbenchLocale) => setLocaleState(next), []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <WorkbenchLocaleContext.Provider value={value}>{children}</WorkbenchLocaleContext.Provider>;
};

export function useWorkbenchLocale(): WorkbenchLocaleContextValue {
  const context = useContext(WorkbenchLocaleContext);
  if (!context) throw new Error('useWorkbenchLocale must be used within WorkbenchLocaleProvider');
  return context;
}
