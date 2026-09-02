/**
 * M45：URL / searchParams 解析工具（包一层 URL，跨端 + node 友好）。
 *
 * 设计原则：try/catch fallback；不依赖 DOM（URL 是 node / browser 全局）。
 */

/**
 * 解析 URL 字符串 —— 返回 null 而不是 throw，跨端（web / mobile / node）通用。
 * @example parseUrl('https://example.com/path?a=1') → URL | null
 * @example parseUrl('not a url') → null
 * @example parseUrl('javascript:alert(1)', ['https:']) → null (protocol 白名单)
 */
export function parseUrl(
  input: string,
  allowedProtocols: string[] = ['http:', 'https:', 'mailto:', 'ws:', 'wss:']
): URL | null {
  if (typeof input !== 'string' || input.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!allowedProtocols.includes(url.protocol)) return null;
  return url;
}

/**
 * 从 URL 字符串拆 search params 为对象（key → string | string[]）。
 * @example parseSearchParams('https://x.com?a=1&b=2&a=3')
 *   → { a: ['1','3'], b: '2' }
 */
export function parseSearchParams(input: string | URL): Record<string, string | string[]> {
  let url: URL;
  if (input instanceof URL) {
    url = input;
  } else {
    const parsed = parseUrl(input);
    if (!parsed) return {};
    url = parsed;
  }
  const out: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  });
  return out;
}

/**
 * 合并 URL base + 路径 + 查询参数。
 * base 可以是绝对 / 相对；params 为空时返回原 base。
 *
 * @example mergeUrl('https://api.com/users', { id: 1 }) → 'https://api.com/users?id=1'
 */
export function mergeUrl(
  base: string,
  path?: string,
  params?: Record<string, string | number | boolean | null | undefined | (string | number | boolean)[]>
): string {
  if (!base) return '';
  if (path) base = base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  if (!params) return base;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const enc = encodeURIComponent;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === null || v === undefined) continue;
        parts.push(`${enc(key)}=${enc(String(v))}`);
      }
    } else {
      parts.push(`${enc(key)}=${enc(String(value))}`);
    }
  }
  if (parts.length === 0) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${parts.join('&')}`;
}