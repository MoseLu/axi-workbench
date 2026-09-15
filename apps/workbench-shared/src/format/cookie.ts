/**
 * M52：跨端共享的 cookie 工具（纯函数 + React hook）。
 *
 * 设计原则：纯函数 + try/catch + SSR-safe（typeof document 检查）。
 */

export interface CookieOptions {
  /** 过期秒数（默认 7 天） */
  maxAge?: number;
  /** 过期 Date（优先于 maxAge） */
  expires?: Date;
  /** 路径（默认 '/'） */
  path?: string;
  /** domain */
  domain?: string;
  /** secure flag */
  secure?: boolean;
  /** SameSite 策略 */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * 读取 cookie —— 返回 raw 字符串，缺失时 null。
 * 跨端：web 直接读 document.cookie；SSR / native 返回 null。
 */
export function readCookie(key: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(key)}=`
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const raw of cookies) {
    if (raw.startsWith(prefix)) {
      return decodeURIComponent(raw.slice(prefix.length));
    }
  }
  return null
}

/**
 * 写入 cookie —— 返回 true 成功 / false 失败（隐私模式等）。
 */
export function writeCookie(key: string, value: string, options: CookieOptions = {}): boolean {
  if (typeof document === 'undefined') return false
  const {
    maxAge = DEFAULT_MAX_AGE,
    expires,
    path = '/',
    domain,
    secure = false,
    sameSite = 'Lax',
  } = options

  let cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  if (expires) cookie += `; expires=${expires.toUTCString()}`
  else if (maxAge) cookie += `; max-age=${maxAge}`
  if (path) cookie += `; path=${path}`
  if (domain) cookie += `; domain=${domain}`
  if (secure) cookie += '; secure'
  if (sameSite) cookie += `; samesite=${sameSite}`

  try {
    document.cookie = cookie
    return true
  } catch {
    return false
  }
}

/**
 * 删除 cookie —— 写到过期。
 */
export function deleteCookie(key: string, path: string = '/'): boolean {
  if (typeof document === 'undefined') return false
  try {
    document.cookie = `${encodeURIComponent(key)}=; max-age=0; path=${path}`
    return true
  } catch {
    return false
  }
}

/**
 * 解析所有 cookies 为对象。
 */
export function readAllCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const out: Record<string, string> = {}
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const raw of cookies) {
    const eq = raw.indexOf('=')
    if (eq === -1) continue
    const k = decodeURIComponent(raw.slice(0, eq))
    const v = decodeURIComponent(raw.slice(eq + 1))
    out[k] = v
  }
  return out
}

/**
 * useCookie —— React hook 包装 readCookie / writeCookie。
 * 跨端通用：用户偏好、登录态、A/B 测试 bucket。
 */
import { useCallback, useEffect, useState } from 'react'

export function useCookie(
  key: string,
  defaultValue: string = '',
  options: CookieOptions = {}
): [string, (value: string, opts?: CookieOptions) => void, () => void] {
  const [value, setValue] = useState<string>(() => readCookie(key) ?? defaultValue)

  useEffect(() => {
    const current = readCookie(key)
    if (current !== null && current !== value) setValue(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setCookie = useCallback(
    (newValue: string, opts: CookieOptions = {}) => {
      const ok = writeCookie(key, newValue, { ...options, ...opts })
      if (ok) setValue(newValue)
    },
    [key, options]
  )

  const removeCookie = useCallback(() => {
    if (deleteCookie(key)) setValue(defaultValue)
  }, [key, defaultValue])

  return [value, setCookie, removeCookie]
}