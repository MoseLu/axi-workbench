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
    out[obj[key]] = key;
  });
  return out;
}
