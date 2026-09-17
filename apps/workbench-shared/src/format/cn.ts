/**
 * Cross-surface className joiner.
 *
 * 三端（web / mobile / desktop 套 web）都依赖 antd + 自定义 CSS class。
 * 实际代码里 `className={isActive ? 'foo' : ''}` 的写法散布各处，
 * 但当 className 由 props 传入或条件组合时容易出现 `false / null / undefined`
 * 漏出到 class 字符串里。
 *
 * 用法：
 *   cn('axi-button', isActive && 'is-active', { 'is-loading': loading })
 *   // → 'axi-button is-active is-loading'（跳过 false / null / undefined）
 *
 * 不替代 Tailwind 的 `clsx` —— 本包不引入 Tailwind 依赖。
 */

export type CnValue =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, boolean | null | undefined>;

export function cn(...values: CnValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v && v !== 0) continue; // skip false / null / undefined / ""
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    } else if (typeof v === 'object') {
      for (const key in v) {
        if (v[key]) out.push(key);
      }
    }
  }
  return out.join(' ');
}