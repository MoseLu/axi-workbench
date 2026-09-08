import zhCN from "./locales/zh-CN.json";
import enUS from "./locales/en-US.json";

export const locales = { "zh-CN": zhCN, "en-US": enUS } as const;
export type Locale = keyof typeof locales;

let currentLocale: Locale = "zh-CN";

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function t(key: string): string {
  const localeData = locales[currentLocale];
  let text = (localeData as Record<string, unknown>)[key] as string | undefined;
  if (!text) {
    text = (locales["zh-CN"] as Record<string, unknown>)[key] as string | undefined;
  }
  return text || key;
}
