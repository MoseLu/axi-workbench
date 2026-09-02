// 跨端共享 hooks（M14 骨架 + M19 通用 hooks + M26 状态 hooks）。
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

/**
 * 二值状态切换 —— boolean 的 helper。返回 [value, toggle, setValue]。
 * 三端通用：折叠面板、modal 显示、checkbox 状态。
 */
export function useToggle(
  initial: boolean | (() => boolean) = false
): [boolean, () => void, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(initial);
  const toggle = () => setValue((v) => !v);
  return [value, toggle, setValue];
}

/**
 * Modal / Drawer / Popover 通用开关 —— 返回 [isOpen, {open, close, toggle}]。
 * 三端通用：登录 modal、侧边详情、确认弹窗。
 */
export function useDisclosure(initial: boolean = false) {
  const [isOpen, setIsOpen] = useState<boolean>(initial);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
    set: setIsOpen,
  } as const;
}

/**
 * 取上一次 render 时的值（首次 render 返回 initial）。
 * 三端通用：useEffect 清理、对比前后值。
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/**
 * 注册 DOM 事件 —— 统一 add/removeEventListener 生命周期。
 *
 * 用法：
 *   useEventListener(window, 'resize', () => setSize({ w, h }));
 *   useEventListener(ref.current, 'scroll', handler, { passive: true });
 */
export function useEventListener<K extends keyof WindowEventMap>(
  target: Window | null | undefined,
  event: K | string,
  handler: (e: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions | boolean
): void;
export function useEventListener<K extends keyof DocumentEventMap>(
  target: Document | null | undefined,
  event: K | string,
  handler: (e: DocumentEventMap[K]) => void,
  options?: AddEventListenerOptions | boolean
): void;
export function useEventListener<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | EventTarget | null | undefined,
  event: K | string,
  handler: (e: HTMLElementEventMap[K] | Event) => void,
  options?: AddEventListenerOptions | boolean
): void;
export function useEventListener(
  target: EventTarget | null | undefined,
  event: string,
  handler: (e: Event) => void,
  options?: AddEventListenerOptions | boolean
): void {
  useEffect(() => {
    if (!target) return;
    target.addEventListener(event, handler, options);
    return () => target.removeEventListener(event, handler, options);
  }, [target, event, handler, options]);
}

/**
 * 点击容器外部时触发回调 —— modal / dropdown / popover 通用。
 */
export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void {
  const savedRef = useRef(handler);
  useEffect(() => {
    savedRef.current = handler;
  }, [handler]);
  useEventListener(
    typeof document !== 'undefined' ? document : null,
    'mousedown',
    (event) => {
      if (!enabled) return;
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      savedRef.current(event);
    }
  );
  useEventListener(
    typeof document !== 'undefined' ? document : null,
    'touchstart',
    (event) => {
      if (!enabled) return;
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      savedRef.current(event);
    }
  );
}

/**
 * 全局键盘按下监听 —— Escape 关闭 modal、Cmd+S 保存等。
 */
export function useKeyPress(
  key: string | string[],
  handler: (event: KeyboardEvent) => void,
  enabled: boolean = true
): void {
  const savedRef = useRef(handler);
  useEffect(() => {
    savedRef.current = handler;
  }, [handler]);
  useEventListener(
    typeof document !== 'undefined' ? document : null,
    'keydown',
    (event) => {
      if (!enabled) return;
      const keys = Array.isArray(key) ? key : [key];
      if (keys.includes(event.key)) {
        savedRef.current(event);
      }
    }
  );
}