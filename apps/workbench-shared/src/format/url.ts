/**
 * M32：跨端共享 URL 查询字符串工具。
 *
 * 三端通用：搜索参数、过滤器、深链还原。
 * 设计原则：纯函数 / 无 URLSearchParams / 跨 node + browser。
 */

/** query 参数值可以是 string / number / boolean / null（移除）/ undefined（同 null）/ 数组（repeat key） */
export type QueryParam = string | number | boolean | null | undefined | QueryParamValue[];
export type QueryParamValue = string | number | boolean;
export type QueryParams = Record<string, QueryParam>;

/**
 * 解析 query string → 参数对象。
 * @example parseQueryString('a=1&b=hello&b=world') → { a: '1', b: ['hello','world'] }
 * @example parseQueryString('a=1&empty=&null') → { a: '1', empty: '', null: '' }
 */
export function parseQueryString(input: string, decode: boolean = true): Record<string, string | string[]> {
  if (typeof input !== 'string') return {};
  const out: Record<string, string | string[]> = {};
  const parts = input.replace(/^\?/, '').split('&');
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf('=');
    let key: string;
    let rawValue: string;
    if (eq === -1) {
      key = part;
      rawValue = '';
    } else {
      key = part.slice(0, eq);
      rawValue = part.slice(eq + 1);
    }
    const decodedKey = decode ? safeDecode(key) : key;
    const decodedValue = decode ? safeDecode(rawValue) : rawValue;
    const existing = out[decodedKey];
    if (existing === undefined) {
      out[decodedKey] = decodedValue;
    } else if (Array.isArray(existing)) {
      existing.push(decodedValue);
    } else {
      out[decodedKey] = [existing, decodedValue];
    }
  }
  return out;
}

/**
 * 构造 query string。
 * - null / undefined / 空字符串 跳过
 * - boolean 序列化为 'true' / 'false'
 * - number 用 String()
 * - 数组用 repeat key（key=a&key=b）
 * - 自动 encodeURIComponent（skip encode 可关）
 *
 * @example buildQueryString({ a: 1, b: 'hi world' }) → 'a=1&b=hi%20world'
 */
export function buildQueryString(
  params: QueryParams,
  options: { encode?: boolean; arrayRepeatKey?: boolean } = {}
): string {
  const { encode = true, arrayRepeatKey = true } = options;
  const parts: string[] = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === null || value === undefined || value === '') continue;
    const enc = (s: string) => (encode ? encodeURIComponent(s) : s);
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === null || v === undefined || v === '') continue;
        parts.push(`${enc(key)}=${enc(String(v))}`);
      }
    } else if (typeof value === 'boolean') {
      parts.push(`${enc(key)}=${value ? 'true' : 'false'}`);
    } else {
      parts.push(`${enc(key)}=${enc(String(value))}`);
    }
    // arrayRepeatKey 默认为 true；显式 false 时第一次出现用 key[] 形式
    if (Array.isArray(value) && !arrayRepeatKey && parts.length > 0) {
      // not implemented — repeat-key is the de-facto standard
    }
  }
  return parts.join('&');
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    // URI malformed → return raw
    return s;
  }
}

/**
 * 安全 URL 拼接 —— 在 base + '?' + query 之间补全问号。
 * 不强制 base 已含 '?'，自动检测。
 *
 * @example buildUrl('/api/users', { id: 1 }) → '/api/users?id=1'
 * @example buildUrl('/api/users?type=admin', { id: 1 }) → '/api/users?type=admin&id=1'
 */
export function buildUrl(base: string, params?: QueryParams): string {
  if (!params || Object.keys(params).length === 0) return base;
  const qs = buildQueryString(params);
  if (!qs) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${qs}`;
}