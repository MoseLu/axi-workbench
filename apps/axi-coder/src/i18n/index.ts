import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import { I18nProvider, useI18n, type CoderLocale } from './I18nProvider';

export type { CoderLocale } from './I18nProvider';

export const coderDictionaries: Record<CoderLocale, Record<string, string>> = {
  'zh-CN': zhCN as Record<string, string>,
  'en-US': enUS as Record<string, string>,
};

export { I18nProvider, useI18n };

/**
 * Format a translation template with simple `{name}` placeholders.
 * Used so consumers can build interpolated strings without pulling a heavy
 * dependency. Unknown placeholders are preserved verbatim.
 */
export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}