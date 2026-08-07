import React, { createContext, useContext, useMemo } from 'react';
import {
  WorkbenchLocaleProvider,
  useWorkbenchLocale,
  type WorkbenchLocale,
} from '@axi/workbench-foundation';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

export type Locale = WorkbenchLocale;

type Messages = Record<string, string>;
const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN as Messages,
  'en-US': enUS as Messages,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <WorkbenchLocaleProvider>
      <I18nDictionaryProvider>{children}</I18nDictionaryProvider>
    </WorkbenchLocaleProvider>
  );
};

const I18nDictionaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { locale, setLocale } = useWorkbenchLocale();

  const value = useMemo<I18nContextValue>(() => {
    const dict = messages[locale];
    return {
      locale,
      setLocale,
      t: (key: string, fallback?: string) => {
        const fromDict = dict[key];
        if (fromDict) return fromDict;
        const fallbackDict = locale === 'zh-CN' ? messages['en-US'] : messages['zh-CN'];
        return fallbackDict[key] ?? fallback ?? key;
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
