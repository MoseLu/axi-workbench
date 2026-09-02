// 跨端共享 hooks（M14 骨架 + M19 通用 hooks）。
// 设计原则：仅依赖 react + 共享 contracts；不调用 fetch / 路由 / 平台 API。

import { useEffect, useRef, useState } from 'react';

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

/**
 * 周期性调用 callback —— 类似 setInterval 但跟 React 生命周期绑定。
 * 适合 inbox 轮询、SSE 兜底、心跳上报。
 * `delayMs = null` 时暂停（轮询临时禁用场景）。
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delayMs === null) return;
    const id = window.setInterval(() => savedRef.current(), delayMs);
    return () => window.clearInterval(id);
  }, [delayMs]);
}

/**
 * 节流一个值 —— 在 windowMs 内只保留第一次变化（leading edge）。
 * 与 useDebouncedValue 不同：节流立即生效但丢弃后续。
 * 适合滚动 / 拖拽场景，1s 内最多 1 次更新。
 */
export function useThrottledValue<T>(value: T, windowMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastTriggerRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    const remaining = windowMs - (now - lastTriggerRef.current);
    if (remaining <= 0) {
      lastTriggerRef.current = now;
      setThrottled(value);
      return;
    }
    const id = window.setTimeout(() => {
      lastTriggerRef.current = Date.now();
      setThrottled(value);
    }, remaining);
    return () => window.clearTimeout(id);
  }, [value, windowMs]);
  return throttled;
}

/**
 * localStorage 同步包装 —— SSR-safe（typeof window 检查）。
 * 三端通用：tab 状态持久化、用户偏好、最近搜索。
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : (JSON.parse(raw) as T);
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