/**
 * M41：纯函数版 debounce / throttle（不依赖 React 生命周期）。
 *
 * 用途：service worker、native module、独立 module（非 React 组件）。
 * React 组件内请用 useDebouncedCallback / useThrottledCallback。
 */

/**
 * 创建一个 debounce 包装的函数 —— 连续调用只在最后一次 delayMs 后触发。
 * 返回包装函数 + cancel() 方法。
 *
 * @example
 *   const debouncedLog = debounce(console.log, 100);
 *   debouncedLog('a'); debouncedLog('b'); debouncedLog('c');
 *   // 100ms 后输出 'c'（合并）
 *   debouncedLog.cancel(); // 取消待执行的调用
 */
export interface DebouncedFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
  flush: () => void;
}

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): DebouncedFn<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: TArgs | null = null;

  const debounced = ((...args: TArgs) => {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      if (pendingArgs) fn(...pendingArgs);
      pendingArgs = null;
      timer = null;
    }, delayMs);
  }) as DebouncedFn<TArgs>;

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingArgs) {
      fn(...pendingArgs);
      pendingArgs = null;
    }
  };

  return debounced;
}

/**
 * 创建一个 throttle 包装的函数 —— leading-edge throttle。
 * 第一次调用立即触发；窗口内后续被合并为一次 trailing。
 *
 * @example
 *   const throttled = throttle(track, 100);
 *   throttled('a'); throttled('b'); throttled('c');
 *   // 立即 track('a')，100ms 后 track('c')
 */
export interface ThrottledFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
}

export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  windowMs: number
): ThrottledFn<TArgs> {
  let lastTrigger = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: TArgs | null = null;

  const throttled = ((...args: TArgs) => {
    const now = Date.now();
    if (now - lastTrigger >= windowMs) {
      lastTrigger = now;
      pendingArgs = null;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      fn(...args);
      return;
    }
    pendingArgs = args;
    if (timer === null) {
      timer = setTimeout(() => {
        lastTrigger = Date.now();
        timer = null;
        const a = pendingArgs;
        pendingArgs = null;
        if (a) fn(...a);
      }, windowMs - (now - lastTrigger));
    }
  }) as ThrottledFn<TArgs>;

  throttled.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  return throttled;
}

/**
 * once —— 包装一个函数只被调用一次（首次调用生效，后续 noop）。
 */
export function once<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn | undefined {
  let called = false;
  return (...args: TArgs) => {
    if (called) return undefined;
    called = true;
    return fn(...args);
  };
}

/**
 * sleep —— 返回一个在 delayMs 后 resolve 的 Promise。
 */
export function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * assertNever —— exhaustiveness check（编译期 + 运行期）。
 * 详见 ./assert/index.ts。
 */
export { assertNever, assertPresent, safeCall, tryOr, type SafeResult } from '../assert';