// 跨端共享的格式化工具占位（M14 骨架 + M20+）。
// 真实实现：M15+ 把 web 端散落的 format helpers 集中到这里。

// M24 string utils —— 单独文件 ./string.ts
export { camelCase, kebabCase, pascalCase, slugify, truncate } from './string';
// M20 cn —— 单独文件 ./cn.ts
export { cn, type CnValue } from './cn';
// M32 URL utils —— 单独文件 ./url.ts
export { buildQueryString, parseQueryString, type QueryParam, type QueryParamValue, type QueryParams } from './url';
// M33 validators —— 单独文件 ./validate.ts
export {
  validateEmail,
  validateLength,
  validateNonEmpty,
  validatePhone,
  validateUrl,
  validateUUID,
  type ValidationResult,
} from './validate';
// M35 privacy mask —— 单独文件 ./privacy.ts
export {
  mask,
  maskBankCard,
  maskEmail,
  maskIdCard,
  maskName,
  maskPhone,
} from './privacy';
// M40 JSON utils —— 单独文件 ./json.ts
export {
  parseJsonSafe,
  requireJsonField,
  safeJsonRoundtrip,
  stringifyJsonSafe,
  type JsonResult,
} from './json';
// M45 URL parse —— 单独文件 ./url-parse.ts
export { mergeUrl, parseSearchParams, parseUrl } from './url-parse';
// M49 immutable object ops —— 单独文件 ./object.ts
export { get, omit, pick, safeUseLocalStorage, set, setPath } from './object';
// M41 pure utils (no React dep) —— 单独文件 ../util/fn
export {
  assertNever,
  assertPresent,
  debounce,
  once,
  safeCall,
  sleep,
  throttle,
  tryOr,
  type DebouncedFn,
  type SafeResult,
  type ThrottledFn,
} from '../util/fn';

export function formatUnreadCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count > 99) return '99+';
  return String(Math.trunc(count));
}

export function formatTimestamp(iso: string | Date, locale: string = 'zh-CN'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** M23：字节数 → 人读（KB/MB/GB/TB/PB），二进制单位。 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  // cap at last unit; values above still report in PB (no overflow)
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/** M23：毫秒数 → 人读（300ms / 2.5s / 1m 30s / 1h 5m）。 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) {
    return totalSec < 10 ? `${totalSec.toFixed(1)}s` : `${Math.round(totalSec)}s`;
  }
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.round(totalSec % 60);
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

/**
 * M28：相对时间（刚刚 / 3 分钟前 / 昨天 / 3 天前），用 zh-CN。
 * 三端都常用：消息列表、任务更新、文件最近编辑。
 */
export function formatRelativeTime(
  iso: string | Date,
  now: Date = new Date(),
  locale: string = 'zh-CN'
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return formatTimestamp(d, locale); // future
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return rtf.format(-sec, 'second');
  const min = Math.floor(sec / 60);
  if (min < 60) return rtf.format(-min, 'minute');
  const hr = Math.floor(min / 60);
  if (hr < 24) return rtf.format(-hr, 'hour');
  const day = Math.floor(hr / 24);
  if (day < 7) return rtf.format(-day, 'day');
  const week = Math.floor(day / 7);
  if (week < 4) return rtf.format(-week, 'week');
  const month = Math.floor(day / 30);
  if (month < 12) return rtf.format(-month, 'month');
  const year = Math.floor(day / 365);
  return rtf.format(-year, 'year');
}

// ============================================================================
// M28：Intl.NumberFormat 系列
// ============================================================================

/** locale 解析：'zh-CN' / 'en-US' / 'de-DE'，fallback zh-CN。 */
function safeLocale(locale: string | undefined): string {
  if (typeof locale !== 'string' || locale.length === 0) return 'zh-CN';
  return locale;
}

/**
 * 数字格式化 —— 接受小数位数 + locale。
 * @example formatNumber(1234.5) === '1,234.5'
 * @example formatNumber(1234.5, 0, 'de-DE') === '1.234,5'
 */
export function formatNumber(
  value: number,
  decimals: number = 0,
  locale: string = 'zh-CN'
): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(safeLocale(locale), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
}

/**
 * 百分比格式化 —— 0.834 → "83.4%"。
 * @example formatPercent(0.834) === '83.4%'
 */
export function formatPercent(
  value: number,
  decimals: number = 1,
  locale: string = 'zh-CN'
): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(safeLocale(locale), {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(decimals)}%`;
  }
}

/**
 * 货币格式化 —— 1234.5 USD → "$1,234.50"
 * @example formatCurrency(1234.5, 'USD', 'en-US') === '$1,234.50'
 * @example formatCurrency(1234.5, 'CNY', 'zh-CN') === '¥1,234.50'
 */
export function formatCurrency(
  value: number,
  currency: string = 'CNY',
  locale: string = 'zh-CN'
): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(safeLocale(locale), {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * 紧凑数字 —— 1234567 → "123万"（zh-CN）或 "1.2M"（en-US）。
 * @example formatCompact(1234567) === '123万' (zh-CN)
 * @example formatCompact(1234567, 'en-US') === '1.2M'
 */
export function formatCompact(
  value: number,
  locale: string = 'zh-CN',
  decimals: number = 1
): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(safeLocale(locale), {
      notation: 'compact',
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return String(value);
  }
}