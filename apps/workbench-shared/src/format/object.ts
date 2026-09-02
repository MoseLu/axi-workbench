/**
 * M49：跨端共享的不可变对象操作（不依赖第三方库）。
 *
 * 设计原则：纯函数 / 不可变 / 类型安全。
 */

import { useEffect, useState } from 'react';

/**
 * pick —— 从对象挑选指定 keys，返回新对象（不修改原对象）。
 * @example
 *   pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) → { a: 1, c: 3 }
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) out[key] = obj[key];
  }
  return out;
}

/**
 * omit —— 从对象排除指定 keys，返回新对象。
 * @example
 *   omit({ a: 1, b: 2, c: 3 }, ['b']) → { a: 1, c: 3 }
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> {
  const out = { ...obj };
  for (const key of keys) {
    delete out[key];
  }
  return out as Omit<T, K>;
}

/**
 * set —— 不可变地设置对象的嵌套路径值（path = ['a', 'b', 'c']）。
 * 中间路径不存在时自动创建对象。
 *
 * @example
 *   set({ a: { b: 1 } }, ['a', 'b'], 2) → { a: { b: 2 } }
 *   set({}, ['x', 'y', 'z'], 1) → { x: { y: { z: 1 } } }
 */
export function set<T extends Record<string, unknown>>(
  obj: T,
  path: readonly string[],
  value: unknown
): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path;
  if (rest.length === 0) {
    return { ...obj, [key]: value } as T;
  }
  const sub = (obj[key] as Record<string, unknown>) ?? {};
  return { ...obj, [key]: set(sub, rest, value) } as T;
}

/**
 * get —— 读取对象嵌套路径值。
 * @example
 *   get({ a: { b: { c: 1 } } }, ['a', 'b', 'c']) → 1
 *   get({ a: 1 }, ['a', 'b']) → undefined
 */
export function get<T = unknown>(
  obj: unknown,
  path: readonly string[]
): T | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur as T | undefined;
}

/**
 * setPath —— set 的别名（命名风格与 lodash 一致）。
 */
export const setPath = set;
// ============================================================================
// M50：safe useLocalStorage —— 带 schema 校验 + catch
// ============================================================================

/**
 * safeUseLocalStorage —— 带 JSON 校验 + 默认值 fallback。
 * 解析失败 / schema 不符 → 使用 initialValue + 静默清理 localStorage。
 *
 * @example
 *   const [user, setUser] = safeUseLocalStorage(
 *     'user',
 *     { id: '', name: '' },
 *     (v): v is { id: string; name: string } => typeof v === 'object' && 'id' in v
 *   );
 */
export function safeUseLocalStorage<T>(
  key: string,
  initialValue: T,
  validate: (raw: unknown) => raw is T = (raw): raw is T => raw !== undefined
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      const parsed: unknown = JSON.parse(raw);
      if (validate(parsed)) return parsed;
      // Validate failed — clean up and fall back
      window.localStorage.removeItem(key);
      return initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 配额溢出 / 隐私模式 → silent
    }
  }, [key, value]);

  return [value, setValue];
}

// ============================================================================
// M54：基于 predicate 的对象操作
// ============================================================================

/**
 * pickBy —— 根据 predicate 挑选满足条件的键值对。
 * @example
 *   pickBy({ a: 1, b: 2, c: 3 }, (v) => v > 1) → { b: 2, c: 3 }
 */
export function pickBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    if (predicate(obj[key], key)) out[key] = obj[key];
  });
  return out;
}

/**
 * omitBy —— 根据 predicate 排除满足条件的键值对。
 * @example
 *   omitBy({ a: 1, b: 2, c: 3 }, (v) => v > 1) → { a: 1 }
 */
export function omitBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> {
  const out: Partial<T> = { ...obj };
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    if (predicate(obj[key], key)) delete out[key];
  });
  return out;
}

/**
 * mapValues —— 对对象的每个 value 应用 transform。
 * @example
 *   mapValues({ a: 1, b: 2 }, (v) => v * 10) → { a: 10, b: 20 }
 */
export function mapValues<T extends Record<string, unknown>, R>(
  obj: T,
  transform: (value: T[keyof T], key: keyof T) => R
): Record<keyof T, R> {
  const out = {} as Record<keyof T, R>;
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    out[key] = transform(obj[key], key);
  });
  return out;
}

/**
 * mapKeys —— 对对象的每个 key 应用 transform。
 * @example
 *   mapKeys({ a: 1, b: 2 }, (k) => k.toUpperCase()) → { A: 1, B: 2 }
 */
export function mapKeys<T extends Record<string, unknown>>(
  obj: T,
  transform: (key: keyof T) => string
): Record<string, T[keyof T]> {
  const out: Record<string, T[keyof T]> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    out[transform(key)] = obj[key];
  });
  return out;
}

/**
 * invertObject —— 交换键值（key→value 变 value→key）。
 * @example
 *   invertObject({ a: 1, b: 2 }) → { 1: 'a', 2: 'b' }
 */
export function invertObject<T extends Record<string, string | number>>(
  obj: T
): Record<string, keyof T> {
  const out: Record<string, keyof T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    out[String(obj[key]) as string] = key;
  });
  return out;
}

// ============================================================================
// M55：DOM MutationObserver / ResizeObserver hooks
// ============================================================================

/**
 * useMutationObserver —— 监听元素 DOM 变更（属性 / 子节点 / 文本）。
 * 三端通用：自动响应 DOM 变化、动态内容同步、埋点曝光。
 * SSR-safe（typeof window 检查）。
 */
export function useMutationObserver(
  ref: React.RefObject<Element>,
  callback: MutationCallback,
  options: MutationObserverInit = { childList: true, subtree: false, attributes: false }
): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !('MutationObserver' in window)) return;
    const el = ref.current;
    if (!el) return;
    const observer = new MutationObserver(callback);
    observer.observe(el, options);
    return () => observer.disconnect();
  }, [ref, options.childList, options.subtree, options.attributes, options.characterData]);
}

/**
 * useResizeObserver —— 监听元素尺寸变化。
 * 返回最新尺寸 { width, height }。
 * SSR-safe。
 */
export interface ElementSize {
  width: number;
  height: number;
}

export function useResizeObserver(
  ref: React.RefObject<Element>,
  options: ResizeObserverOptions = {}
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  useEffect(() => {
    if (typeof window === 'undefined' || !('ResizeObserver' in window)) return;
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el, options);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * useElementSize —— useResizeObserver 的便利 wrapper。
 * 直接传 ref，返回最新尺寸。
 */
export function useElementSize<T extends Element>(
  ref: React.RefObject<T>
): ElementSize {
  return useResizeObserver(ref);
}

// ============================================================================
// M56：i18n 货币 / 单位
// ============================================================================

/**
 * 区域感知的货币格式化 —— 在不同地区用不同 currency code。
 * @example
 *   formatCurrencyByLocale(100, { 'zh-CN': 'CNY', 'en-US': 'USD' }, 'zh-CN')
 *   → '¥100.00'  (zh-CN 用 CNY → ¥)
 *   formatCurrencyByLocale(100, { 'zh-CN': 'CNY', 'en-US': 'USD' }, 'en-US')
 *   → '$100.00'  (en-US 用 USD → $)
 */
export function formatCurrencyByLocale(
  value: number,
  localeCurrencyMap: Record<string, string>,
  locale: string = 'zh-CN'
): string {
  if (!Number.isFinite(value)) return '';
  const currency = localeCurrencyMap[locale] ?? 'USD';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * 单位转换 + 区域 locale 标签。
 * @example
 *   formatUnit(1024, 'B') → '1.0 KB' (zh-CN)
 *   formatUnit(1024, 'B', 'en-US') → '1.0 kB'  (note: lowercase k in en-US)
 */
export function formatUnit(value: number, unit: string, locale: string = 'zh-CN'): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).format(value);
  } catch {
    return `${value} ${unit}`;
  }
}
