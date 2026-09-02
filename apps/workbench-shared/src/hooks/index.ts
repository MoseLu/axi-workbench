// 跨端共享 hooks（M14 骨架 + M19 通用 hooks + M26 状态 hooks）。
// 设计原则：仅依赖 react + 共享 contracts；不调用 fetch / 路由 / 平台 API。

import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * M29：防抖一个回调 —— 连续触发只在最后一次后 delayMs 触发一次。
 * 跨端通用：搜索框实时过滤（避免每个 keystroke 都调 API）、按钮防抖。
 *
 * 与 useDebouncedValue 的区别：后者包装值（state），前者包装函数（callback）。
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number
): (...args: TArgs) => void {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  }, []);
  return (...args: TArgs) => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => savedRef.current(...args), delayMs);
  };
}

/**
 * M29：节流一个回调 —— leading-edge 节流：每次窗口起点立刻触发，
 * 窗口内的后续调用被压成一次 trailing-edge 调用（取最新参数）。
 *
 * @example
 *   const throttled = useThrottledCallback(track, 100);
 *   throttled(a); throttled(b); throttled(c);
 *   // 立即 track(a)，100ms 后 track(c)。中间的 track(b) 被合并。
 */
export function useThrottledCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  windowMs: number
): (...args: TArgs) => void {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  const lastTriggerRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<{ args: TArgs } | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  }, []);

  return (...args: TArgs) => {
    const now = Date.now();
    const elapsed = now - lastTriggerRef.current;
    if (elapsed >= windowMs) {
      // 窗口外 → leading edge
      lastTriggerRef.current = now;
      pendingRef.current = null;
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      savedRef.current(...args);
      return;
    }
    // 窗口内 → 排队 trailing edge
    pendingRef.current = { args };
    if (timerRef.current === undefined) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        lastTriggerRef.current = Date.now();
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) savedRef.current(...pending.args);
      }, windowMs - elapsed);
    }
  };
}

// ============================================================================
// M30：响应式 hooks
// ============================================================================

/**
 * CSS media query 监听 —— SSR-safe，window 不可用时返回 query 的静态推断结果。
 *
 * @example
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *   const isDark = useMediaQuery('(prefers-color-scheme: dark)');
 */
export function useMediaQuery(query: string, fallback: boolean = false): boolean {
  const getMatch = (): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return fallback;
    return window.matchMedia(query).matches;
  };
  const [matches, setMatches] = useState<boolean>(getMatch);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Safari < 14
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);
  return matches;
}

/**
 * 窗口尺寸 —— 用 ResizeObserver 监听 window 尺寸变化。
 * SSR-safe（typeof window 检查）。
 */
export interface WindowSize {
  width: number;
  height: number;
}
export function useWindowSize(): WindowSize {
  const getSize = (): WindowSize => {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  };
  const [size, setSize] = useState<WindowSize>(getSize);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setSize(getSize());
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

/** 默认断点（参照 Tailwind CSS）。 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * 当前断点 —— 返回 >= 当前 viewport 宽度的最大断点 key。
 * @example viewport 800px → 'md'
 */
export function useBreakpoint(): Breakpoint | 'xs' {
  const { width } = useWindowSize();
  const entries = Object.entries(BREAKPOINTS) as [Breakpoint, number][];
  let current: Breakpoint | 'xs' = 'xs';
  for (const [key, min] of entries) {
    if (width >= min) current = key;
  }
  return current;
}

// ============================================================================
// M31：异步状态管理 hooks
// ============================================================================

/**
 * useAsyncFn —— 把 async 函数包装成 `{ loading, error, value, run }` 四元组。
 *
 * 三端通用：消息搜索、用户拉取、设置保存。
 * **不依赖** TanStack Query / SWR —— 是更底层的 hook，跨端通用。
 *
 * 用法：
 *   const search = useAsyncFn(async (q: string) => fetchJson(`/api/search?q=${q}`));
 *   search.run('foo'); search.value; search.loading; search.error;
 */
export interface AsyncState<TArgs extends unknown[], TResult> {
  loading: boolean;
  error: unknown | null;
  value: TResult | null;
  run: (...args: TArgs) => Promise<TResult | null>;
  reset: () => void;
}

export function useAsyncFn<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): AsyncState<TArgs, TResult> {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const [state, setState] = useState<{
    loading: boolean;
    error: unknown | null;
    value: TResult | null;
  }>({ loading: false, error: null, value: null });
  const runRef = useRef<(...args: TArgs) => Promise<TResult | null>>();
  if (!runRef.current) {
    runRef.current = async (...args: TArgs) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const value = await fnRef.current(...args);
        setState({ loading: false, error: null, value });
        return value;
      } catch (error) {
        setState({ loading: false, error, value: null });
        return null;
      }
    };
  }
  return {
    ...state,
    run: runRef.current,
    reset: () => setState({ loading: false, error: null, value: null }),
  };
}

/**
 * useAsync —— 类似 useAsyncFn 但 deps 变化时自动重跑。
 *
 * 用法：
 *   const { value, loading, error } = useAsync(
 *     () => fetchJson('/api/users/me'),
 *     []
 *   );
 */
export function useAsync<TResult>(
  fn: () => Promise<TResult>,
  deps: React.DependencyList
): Omit<AsyncState<[], TResult>, 'run' | 'reset'> & { refetch: () => void } {
  const { run, ...rest } = useAsyncFn(fn);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    void runRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...rest, refetch: () => void runRef.current() };
}

/**
 * M36：useFetch —— useAsync 的 fetch 专用版本。
 *
 * 用法：
 *   const { value: user, loading, error } = useFetch<User>('/api/users/me');
 *   const { value, refetch } = useFetch<Post[]>('/api/posts', { skip: !user });
 *
 * 特性：
 * - 自动 AbortController：组件 unmount 时取消未完成请求
 * - 自动 JSON 解析
 * - deps 变化时自动 refetch
 * - 304 Not Modified 走 cache（默认 fetch 行为）
 */
export interface UseFetchOptions extends Omit<RequestInit, 'signal'> {
  /** 跳过请求（条件加载） */
  skip?: boolean;
  /** URL 变化时是否 refetch（默认 true） */
  refetchOnUrlChange?: boolean;
}

export function useFetch<T = unknown>(
  url: string,
  options: UseFetchOptions = {}
): {
  loading: boolean;
  error: unknown | null;
  value: T | null;
  refetch: () => void;
} {
  const { skip = false, refetchOnUrlChange = true, ...fetchInit } = options;
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    // Cancel any in-flight request on unmount or url change
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, [url]);

  const fn = useCallback(async (): Promise<T | null> => {
    if (skip) return null;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch(url, { ...fetchInit, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [url, skip, JSON.stringify(fetchInit)]); // eslint-disable-line react-hooks/exhaustive-deps

  const { loading, error, value, run } = useAsync<T | null>(fn, [url, skip]);
  const runRef = useRef(run);
  runRef.current = run;
  return { loading, error, value, refetch: () => void runRef.current() };
}

// ============================================================================
// M37：UI 体验 hooks
// ============================================================================

/**
 * document.title 同步 —— 三端通用：详情页、消息、loading 态。
 * 组件 unmount 时自动恢复原 title。
 */
export function useDocumentTitle(title: string, options: { restoreOnUnmount?: boolean } = {}): void {
  const { restoreOnUnmount = true } = options;
  useEffect(() => {
    const previous = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') document.title = title;
    return () => {
      if (restoreOnUnmount && typeof document !== 'undefined') {
        document.title = previous;
      }
    };
  }, [title, restoreOnUnmount]);
}

/**
 * Modal / Drawer 焦点陷阱 —— 焦点在容器内循环。
 * Tab 走到最后一个 → 回到第一个；Shift+Tab 走到第一个 → 跳到最后一个。
 * 跨端通用：所有 modal / drawer / popover 焦点可达性。
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: React.RefObject<T>,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [ref, enabled]);
}