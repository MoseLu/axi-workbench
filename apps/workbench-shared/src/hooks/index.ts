// 跨端共享 hooks 占位（M14 骨架）。
// 设计原则：仅依赖 react + 共享 contracts；不调用 fetch / 路由 / 平台 API。

import { useEffect, useState } from 'react';

/**
 * 防抖一个值 —— 在 delay ms 内的连续变化只保留最后一次。
 * 跨端通用：通知中心 / inbox 实时刷新限流都会用到。
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}