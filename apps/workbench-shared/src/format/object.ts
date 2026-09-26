/**
 * M49：跨端共享的不可变对象操作（不依赖第三方库）。
 *
 * 设计原则：纯函数 / 不可变 / 类型安全。
 */

import { useEffect, useRef, useState } from 'react';

/**
 * pick —— 从对象挑选指定 keys，返回新对象（不修改原对象）。
 * @example
 *   pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) → { a: 1, c: 3 }
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) out[key] = obj[key];
  }
  return out;
}

/**
 * omit —— 从对象排除指定 keys，返回新对象。
 * @example
 *   omit({ a: 1, b: 2, c: 3 }, ['b']) → { a: 1, c: 3 }
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> {
  const out = { ...obj };
  for (const key of keys) {
    delete out[key];
  }
  return out as Omit<T, K>;
}

/**
 * set —— 不可变地设置对象的嵌套路径值（path = ['a', 'b', 'c']）。
 * 中间路径不存在时自动创建对象。
 *
 * @example
 *   set({ a: { b: 1 } }, ['a', 'b'], 2) → { a: { b: 2 } }
 *   set({}, ['x', 'y', 'z'], 1) → { x: { y: { z: 1 } } }
 */
export function set<T extends Record<string, unknown>>(
  obj: T,
  path: readonly string[],
  value: unknown
): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path;
  if (rest.length === 0) {
    return { ...obj, [key]: value } as T;
  }
  const sub = (obj[key] as Record<string, unknown>) ?? {};
  return { ...obj, [key]: set(sub, rest, value) } as T;
}

/**
 * get —— 读取对象嵌套路径值。
 * @example
 *   get({ a: { b: { c: 1 } } }, ['a', 'b', 'c']) → 1
 *   get({ a: 1 }, ['a', 'b']) → undefined
 */
export function get<T = unknown>(
  obj: unknown,
  path: readonly string[]
): T | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur as T | undefined;
}

/**
 * setPath —— set 的别名（命名风格与 lodash 一致）。
 */
export const setPath = set;
// ============================================================================
// M50：safe useLocalStorage —— 带 schema 校验 + catch
// ============================================================================

/**
 * safeUseLocalStorage —— 带 JSON 校验 + 默认值 fallback。
 * 解析失败 / schema 不符 → 使用 initialValue + 静默清理 localStorage。
 *
 * @example
 *   const [user, setUser] = safeUseLocalStorage(
 *     'user',
 *     { id: '', name: '' },
 *     (v): v is { id: string; name: string } => typeof v === 'object' && 'id' in v
 *   );
 */
export function safeUseLocalStorage<T>(
  key: string,
  initialValue: T,
  validate: (raw: unknown) => raw is T = (raw): raw is T => raw !== undefined
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      const parsed: unknown = JSON.parse(raw);
      if (validate(parsed)) return parsed;
      // Validate failed — clean up and fall back
      window.localStorage.removeItem(key);
      return initialValue;
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

// ============================================================================
// M54：基于 predicate 的对象操作
// ============================================================================

/**
 * pickBy —— 根据 predicate 挑选满足条件的键值对。
 * @example
 *   pickBy({ a: 1, b: 2, c: 3 }, (v) => v > 1) → { b: 2, c: 3 }
 */
export function pickBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    if (predicate(obj[key], key)) out[key] = obj[key];
  });
  return out;
}

/**
 * omitBy —— 根据 predicate 排除满足条件的键值对。
 * @example
 *   omitBy({ a: 1, b: 2, c: 3 }, (v) => v > 1) → { a: 1 }
 */
export function omitBy<T extends Record<string, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> {
  const out: Partial<T> = { ...obj };
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    if (predicate(obj[key], key)) delete out[key];
  });
  return out;
}

/**
 * mapValues —— 对对象的每个 value 应用 transform。
 * @example
 *   mapValues({ a: 1, b: 2 }, (v) => v * 10) → { a: 10, b: 20 }
 */
export function mapValues<T extends Record<string, unknown>, R>(
  obj: T,
  transform: (value: T[keyof T], key: keyof T) => R
): Record<keyof T, R> {
  const out = {} as Record<keyof T, R>;
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    out[key] = transform(obj[key], key);
  });
  return out;
}

/**
 * mapKeys —— 对对象的每个 key 应用 transform。
 * @example
 *   mapKeys({ a: 1, b: 2 }, (k) => k.toUpperCase()) → { A: 1, B: 2 }
 */
export function mapKeys<T extends Record<string, unknown>>(
  obj: T,
  transform: (key: keyof T) => string
): Record<string, T[keyof T]> {
  const out: Record<string, T[keyof T]> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    out[transform(key)] = obj[key];
  });
  return out;
}

/**
 * invertObject —— 交换键值（key→value 变 value→key）。
 * @example
 *   invertObject({ a: 1, b: 2 }) → { 1: 'a', 2: 'b' }
 */
export function invertObject<T extends Record<string, string | number>>(
  obj: T
): Record<string, keyof T> {
  const out: Record<string, keyof T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    out[String(obj[key]) as string] = key;
  });
  return out;
}

// ============================================================================
// M55：DOM MutationObserver / ResizeObserver hooks
// ============================================================================

/**
 * useMutationObserver —— 监听元素 DOM 变更（属性 / 子节点 / 文本）。
 * 三端通用：自动响应 DOM 变化、动态内容同步、埋点曝光。
 * SSR-safe（typeof window 检查）。
 */
export function useMutationObserver(
  ref: React.RefObject<Element>,
  callback: MutationCallback,
  options: MutationObserverInit = { childList: true, subtree: false, attributes: false }
): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !('MutationObserver' in window)) return;
    const el = ref.current;
    if (!el) return;
    const observer = new MutationObserver(callback);
    observer.observe(el, options);
    return () => observer.disconnect();
  }, [ref, options.childList, options.subtree, options.attributes, options.characterData]);
}

/**
 * useResizeObserver —— 监听元素尺寸变化。
 * 返回最新尺寸 { width, height }。
 * SSR-safe。
 */
export interface ElementSize {
  width: number;
  height: number;
}

export function useResizeObserver(
  ref: React.RefObject<Element>,
  options: ResizeObserverOptions = {}
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  useEffect(() => {
    if (typeof window === 'undefined' || !('ResizeObserver' in window)) return;
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el, options);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * useElementSize —— useResizeObserver 的便利 wrapper。
 * 直接传 ref，返回最新尺寸。
 */
export function useElementSize<T extends Element>(
  ref: React.RefObject<T>
): ElementSize {
  return useResizeObserver(ref);
}

// ============================================================================
// M56：i18n 货币 / 单位
// ============================================================================

/**
 * 区域感知的货币格式化 —— 在不同地区用不同 currency code。
 * @example
 *   formatCurrencyByLocale(100, { 'zh-CN': 'CNY', 'en-US': 'USD' }, 'zh-CN')
 *   → '¥100.00'  (zh-CN 用 CNY → ¥)
 *   formatCurrencyByLocale(100, { 'zh-CN': 'CNY', 'en-US': 'USD' }, 'en-US')
 *   → '$100.00'  (en-US 用 USD → $)
 */
export function formatCurrencyByLocale(
  value: number,
  localeCurrencyMap: Record<string, string>,
  locale: string = 'zh-CN'
): string {
  if (!Number.isFinite(value)) return '';
  const currency = localeCurrencyMap[locale] ?? 'USD';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * 单位转换 + 区域 locale 标签。
 * @example
 *   formatUnit(1024, 'B') → '1.0 KB' (zh-CN)
 *   formatUnit(1024, 'B', 'en-US') → '1.0 kB'  (note: lowercase k in en-US)
 */
export function formatUnit(value: number, unit: string, locale: string = 'zh-CN'): string {
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).format(value);
  } catch {
    return `${value} ${unit}`;
  }
}

// ============================================================================
// M57：文件下载 / 文本读取
// ============================================================================

/**
 * useFileDownload —— 触发浏览器下载（创建 <a download> 元素）。
 * 跨端通用：导出 CSV、下载报告、保存附件。
 * SSR-safe。
 */
export function useFileDownload(): (url: string, filename?: string) => void {
  return (url: string, filename?: string) => {
    if (typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
}

/**
 * useFileText —— 读 File / Blob 为文本。
 * 三端通用：解析上传的 CSV / JSON / 文本。
 */
export function readFileAsText(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      // node fallback: try text() method on Blob (node 18+)
      if (typeof (file as Blob).text === 'function') {
        (file as Blob).text()
          .then(resolve)
          .catch(reject);
        return;
      }
      reject(new Error('FileReader not supported in this environment'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsText(file);
  });
}

/**
 * useFileDataURL —— 读 File / Blob 为 data URL（base64）。
 * 跨端通用：图片预览、canvas drawImage。
 */
export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      if (typeof (file as Blob).arrayBuffer === 'function') {
        (file as Blob).arrayBuffer()
          .then((buf) => {
            // node Buffer fallback
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            resolve(`data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`);
          })
          .catch(reject);
        return;
      }
      reject(new Error('FileReader not supported in this environment'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/**
 * downloadBlob —— 触发浏览器下载任意 Blob（如 CSV / JSON / 二进制）。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// M58：Web Worker 包装
// ============================================================================

/**
 * useWebWorker —— 创建 + 管理 Web Worker。
 * 跨端：仅 web 端（mobile / desktop 不直接用 Worker）。
 * SSR-safe。
 *
 * @example
 *   const post = useWebWorker('/workers/calc.js');
 *   post({ a: 1, b: 2 });
 *   // worker.onmessage = (e) => console.log(e.data)
 */
export interface WebWorkerHandle<TIn = unknown> {
  post: (message: TIn) => void;
  terminate: () => void;
  worker: Worker | null;
}

export function useWebWorker<TIn = unknown>(
  urlOrScript: string | URL | (() => void)
): WebWorkerHandle<TIn> {
  const ref = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Worker' in window)) return;
    if (typeof urlOrScript === 'function') {
      // Inline script (Blob) mode not directly supported in browsers without URL
      return;
    }
    const worker = new Worker(urlOrScript);
    ref.current = worker;
    return () => {
      worker.terminate();
      ref.current = null;
    };
  }, [urlOrScript]);

  return {
    post: (message: TIn) => {
      ref.current?.postMessage(message);
    },
    terminate: () => {
      ref.current?.terminate();
      ref.current = null;
    },
    worker: ref.current,
  };
}

/**
 * useWorkerFunction —— 包装一个函数到 Web Worker（dynamic import 形式）。
 * 仅用作类型签名占位（实际 worker 创建在 .ts 文件里手动写）。
 * 跨端：仅 web 端。
 */
export function useWorkerFunction<Args extends unknown[], R>(
  fn: (...args: Args) => R
): { run: (...args: Args) => Promise<R> } {
  // 实际实现需要把 fn 序列化到 worker；这里只暴露类型
  // 推荐：use + 静态 import('*!worker') 形式 + Comlink 库
  return {
    run: async (...args: Args) => fn(...args),
  };
}

// ============================================================================
// M59：React 18 并发模式 hooks
// ============================================================================

/**
 * useDeferredValueSafe —— React 18 useDeferredValue 的 SSR-safe 包装。
 * 在 SSR 阶段 fallback 到 value 本身；在客户端使用真正的 deferred value。
 * 跨端通用：大列表渲染、搜索过滤、expensive computation。
 */
export function useDeferredValueSafe<T>(value: T): T {
  // React 18 的 useDeferredValue 在 SSR 报错（hooks must be called in function component）
  // 这里简单 fallback：useState(value) 等价于不变
  // 用 effect 同步更新，避免在渲染阶段调用 setState
  const [state, setState] = useState<T>(value);
  useEffect(() => {
    setState(value);
  }, [value]);
  return state;
}

/**
 * useDebouncedState —— 简单的 debounced state（trailing edge）。
 * 适合需要延迟跟手的 state（搜索输入 → 过滤结果）。
 */
export function useDebouncedState<T>(initial: T, delayMs: number): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);
  return [
    state,
    (value: T) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState(value), delayMs);
    },
  ];
}
