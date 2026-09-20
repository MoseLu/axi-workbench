const DEFAULT_LOCALE = 'zh-CN'

export function resolveLocale(preferred?: string | string[]): string {
  if (typeof preferred === 'string' && preferred.trim()) {
    return preferred
  }

  if (Array.isArray(preferred)) {
    const first = preferred.find((entry) => typeof entry === 'string' && entry.trim())
    if (first) return first
  }

  if (typeof navigator !== 'undefined') {
    const browserLocale = navigator.languages?.find(Boolean) || navigator.language
    if (browserLocale) return browserLocale
  }

  return DEFAULT_LOCALE
}

export function formatDisplayDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
  preferredLocale?: string | string[],
): string {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(resolveLocale(preferredLocale), options).format(date)
}
