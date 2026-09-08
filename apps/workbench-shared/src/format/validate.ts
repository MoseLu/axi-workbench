/**
 * M33：跨端共享的输入校验工具。
 *
 * 设计原则：纯函数；返回结构化 { ok, reason } 不抛错；
 * 不依赖 zod / yup 等外部库（保持零依赖）。
 */

/** 校验结果：成功 → { ok: true, value }；失败 → { ok: false, reason } */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/**
 * 非空字符串校验
 * @example validateNonEmpty('') → { ok: false, reason: 'empty' }
 */
export function validateNonEmpty(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, reason: 'not_string' };
  if (value.trim().length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, value };
}

/**
 * Email 校验 —— 简化版 RFC 5322。
 * 不做 IDN / 引号本地部分 / 国际化邮箱等高级特性。
 *
 * @example validateEmail('foo@bar.com') → { ok: true, value: 'foo@bar.com' }
 * @example validateEmail('foo@') → { ok: false, reason: 'invalid_format' }
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, reason: 'not_string' };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length > 254) return { ok: false, reason: 'too_long' };
  if (!EMAIL_RE.test(trimmed)) return { ok: false, reason: 'invalid_format' };
  return { ok: true, value: trimmed.toLowerCase() };
}

/**
 * URL 校验 —— 仅支持 http / https / mailto / ws / wss 协议。
 * 不验证可达性；不处理相对路径。
 *
 * @example validateUrl('https://example.com') → { ok: true }
 * @example validateUrl('javascript:alert(1)') → { ok: false, reason: 'unsafe_protocol' }
 */
export function validateUrl(value: unknown, allowedProtocols: string[] = ['http:', 'https:', 'mailto:', 'ws:', 'wss:']): ValidationResult<URL> {
  if (typeof value !== 'string') return { ok: false, reason: 'not_string' };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_format' };
  }
  if (!allowedProtocols.includes(url.protocol)) {
    return { ok: false, reason: 'unsafe_protocol' };
  }
  return { ok: true, value: url };
}

/**
 * UUID 校验 —— 支持 v1-v5（hex + 8-4-4-4-12 格式，version digit 1-5）。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateUUID(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, reason: 'not_string' };
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) return { ok: false, reason: 'invalid_format' };
  return { ok: true, value: trimmed.toLowerCase() };
}

/**
 * 手机号校验 —— 中国大陆 11 位 1[3-9]\d{9}。其他国家请扩展。
 */
const CN_PHONE_RE = /^1[3-9]\d{9}$/;
export function validatePhone(value: unknown, region: 'CN' | 'any' = 'CN'): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, reason: 'not_string' };
  const cleaned = value.replace(/[\s\-()+]/g, '');
  if (region === 'CN') {
    if (!CN_PHONE_RE.test(cleaned)) return { ok: false, reason: 'invalid_format' };
  } else {
    if (!/^\d{6,15}$/.test(cleaned)) return { ok: false, reason: 'invalid_format' };
  }
  return { ok: true, value: cleaned };
}

/**
 * 长度校验 —— 给定 min / max（含），返回 trim 后字符串。
 */
export function validateLength(
  value: unknown,
  min: number,
  max: number
): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, reason: 'not_string' };
  const trimmed = value.trim();
  if (trimmed.length < min) return { ok: false, reason: 'too_short' };
  if (trimmed.length > max) return { ok: false, reason: 'too_long' };
  return { ok: true, value: trimmed };
}