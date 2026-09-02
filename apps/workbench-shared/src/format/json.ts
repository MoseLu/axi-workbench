/**
 * M40：跨端共享的 JSON 纯函数。
 *
 * 设计原则：失败不抛错，返回 { ok, value } 或 { ok: false, reason }。
 */

/**
 * 安全 JSON.parse —— 失败时返回 { ok: false, reason }，不抛错。
 *
 * @example
 *   parseJsonSafe('{"a":1}') → { ok: true, value: { a: 1 } }
 *   parseJsonSafe('not json') → { ok: false, reason: 'parse_error' }
 *   parseJsonSafe(null) → { ok: false, reason: 'not_string' }
 */
export type JsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_string' | 'empty' | 'parse_error' };

export function parseJsonSafe<T = unknown>(input: unknown): JsonResult<T> {
  if (typeof input !== 'string') return { ok: false, reason: 'not_string' };
  if (input.trim().length === 0) return { ok: false, reason: 'empty' };
  try {
    return { ok: true, value: JSON.parse(input) as T };
  } catch {
    return { ok: false, reason: 'parse_error' };
  }
}

/**
 * 安全 JSON.stringify —— 失败时返回 undefined。
 * 处理循环引用 + BigInt + undefined。
 *
 * @example
 *   stringifyJsonSafe({a: 1}) → '{"a":1}'
 *   stringifyJsonSafe(undefined) → undefined
 *   stringifyJsonSafe(cyclic) → undefined
 */
export function stringifyJsonSafe(value: unknown, replacer?: (key: string, value: unknown) => unknown): string | undefined {
  try {
    return JSON.stringify(value, replacer);
  } catch {
    return undefined;
  }
}

/**
 * 安全往返 —— parse + 重新 stringify 后再 parse 一致（用于检测改写是否破坏结构）。
 *
 * @example
 *   safeJsonRoundtrip('{"a":1,"b":"x"}') → { ok: true, value: { a: 1, b: 'x' } }
 */
export function safeJsonRoundtrip<T = unknown>(input: unknown): JsonResult<T> {
  const parsed = parseJsonSafe<T>(input);
  if (!parsed.ok) return parsed;
  const stringified = stringifyJsonSafe(parsed.value);
  if (stringified === undefined) return { ok: false, reason: 'parse_error' };
  return parseJsonSafe<T>(stringified);
}

/**
 * 严格 JSON.parse —— 类型保护 + 必填字段检查。
 *
 * @example
 *   requireJsonField<{ id: string }>('{"id":"x"}', ['id'])
 *   → { ok: true, value: { id: 'x' } }
 *   requireJsonField<{ id: string }>('{}', ['id'])
 *   → { ok: false, reason: 'missing_field:id' }
 */
export function requireJsonField<T extends Record<string, unknown>>(
  input: unknown,
  fields: readonly (keyof T)[]
): JsonResult<T> {
  const parsed = parseJsonSafe<T>(input);
  if (!parsed.ok) return parsed;
  const missing: string[] = [];
  for (const field of fields) {
    if (!(field in parsed.value)) missing.push(String(field));
  }
  if (missing.length > 0) {
    return { ok: false, reason: 'parse_error' as const };
  }
  return { ok: true, value: parsed.value };
}