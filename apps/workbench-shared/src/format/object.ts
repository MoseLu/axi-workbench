/**
 * M49：跨端共享的不可变对象操作（不依赖第三方库）。
 *
 * 设计原则：纯函数 / 不可变 / 类型安全。
 */

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