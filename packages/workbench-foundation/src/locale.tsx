import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

export const WorkbenchLocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<WorkbenchLocale>(readLocale);

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

  const setLocale = useCallback((next: WorkbenchLocale) => setLocaleState(next), []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <WorkbenchLocaleContext.Provider value={value}>{children}</WorkbenchLocaleContext.Provider>;
};

export function useWorkbenchLocale(): WorkbenchLocaleContextValue {
  const context = useContext(WorkbenchLocaleContext);
  if (!context) throw new Error('useWorkbenchLocale must be used within WorkbenchLocaleProvider');
  return context;
}
