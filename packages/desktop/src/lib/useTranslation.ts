/**
 * i18n Hook
 */

import { useCallback } from 'react'
import zh_CN, { Locale } from './i18n'

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : K
        : never
    }[keyof T]
  : never

type TranslationKey = NestedKeyOf<Locale>

export function useTranslation() {
  const t = useCallback((key: string): string => {
    const keys = key.split('.')
    let value: unknown = zh_CN

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return key // Return key if not found
      }
    }

    return typeof value === 'string' ? value : key
  }, [])

  return { t }
}
