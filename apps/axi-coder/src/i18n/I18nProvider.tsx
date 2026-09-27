import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CoderLocale = 'zh-CN' | 'en-US';

export const CODER_LOCALE_STORAGE_KEY = 'axi-coder.locale';

const DEFAULT_LOCALE: CoderLocale = 'zh-CN';

function isCoderLocale(value: unknown): value is CoderLocale {
  return value === 'zh-CN' || value === 'en-US';
}

function readStoredLocale(): CoderLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(CODER_LOCALE_STORAGE_KEY);
    return isCoderLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export interface I18nContextValue {
  locale: CoderLocale;
  setLocale: (next: CoderLocale) => void;
  /**
   * Translate a key. When the key is missing in the current locale dictionary,
   * the optional `fallback` is returned. This keeps existing Chinese copy
   * working while allowing English copy to opt-in by adding the key.
   */
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  dictionaries?: Partial<Record<CoderLocale, Record<string, string>>>;
  defaultLocale?: CoderLocale;
}

export function I18nProvider({
  children,
  dictionaries = {},
  defaultLocale = DEFAULT_LOCALE,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<CoderLocale>(() => readStoredLocale() || defaultLocale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    try {
      window.localStorage.setItem(CODER_LOCALE_STORAGE_KEY, locale);
    } catch {
      // localStorage may be disabled; the in-memory locale still works.
    }
  }, [locale]);

  const setLocale = useCallback((next: CoderLocale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const dictionary = dictionaries[locale];
      const value = dictionary?.[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
      const fallbackDictionary = dictionaries[defaultLocale];
      const fallbackValue = fallbackDictionary?.[key];
      if (typeof fallbackValue === 'string' && fallbackValue.length > 0) {
        return fallbackValue;
      }
      return fallback ?? key;
    },
    [dictionaries, locale, defaultLocale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // Tests / standalone renderers can call components without wrapping them
    // in I18nProvider. Returning a no-op provider keeps those tests working
    // and lets components default to the Chinese dictionary in production
    // environments where the provider has not yet been mounted.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (_key: string, fallback?: string) => fallback ?? _key,
    };
  }
  return context;
}