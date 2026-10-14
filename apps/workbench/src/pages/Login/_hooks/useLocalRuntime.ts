/**
 * 工作台登录页 — 桌面壳本机运行时门禁。
 *
 * 从原 Login.tsx 组件体搬出：订阅本机服务状态、轮询刷新、失败后重试。
 * 浏览器访问时 required 恒为 false，不会订阅也不会阻塞登录。
 */
import { useEffect, useState } from 'react';
import {
  getLocalRuntimeStatus,
  isLocalRuntimeBlocked,
  listenLocalRuntimeStatus,
  LOCAL_RUNTIME_STARTING,
  retryLocalRuntime,
  type LocalRuntimeStatus,
} from '../../../lib/localRuntime';
import { isTauriShell } from '../../../lib/shell';

export interface LocalRuntimeGate {
  /** 桌面壳要求本机服务就绪、但服务仍不可用时为 true；浏览器访问恒为 false。 */
  blocked: boolean;
  status: LocalRuntimeStatus | null;
  retry: () => Promise<void>;
}

export function useLocalRuntime(): LocalRuntimeGate {
  const [status, setStatus] = useState<LocalRuntimeStatus | null>(null);
  const [resolved, setResolved] = useState(() => !isTauriShell());
  const required = isTauriShell() && import.meta.env.VITE_DESKTOP_LOCAL_RUNTIME === 'true';
  const blocked = isLocalRuntimeBlocked(required, resolved, status);

  useEffect(() => {
    if (!required) return undefined;
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    const refresh = async () => {
      const next = await getLocalRuntimeStatus();
      if (cancelled) return;
      setStatus(next);
      setResolved(true);
    };
    void refresh();
    void listenLocalRuntimeStatus((next) => {
      if (cancelled) return;
      setStatus(next);
      setResolved(true);
    }).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    const interval = window.setInterval(() => void refresh(), 750);
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [required]);

  const retry = async () => {
    setStatus(LOCAL_RUNTIME_STARTING);
    setResolved(true);
    try {
      await retryLocalRuntime();
    } catch (cause: unknown) {
      setStatus({
        ...LOCAL_RUNTIME_STARTING,
        phase: 'failed',
        error: cause instanceof Error ? cause.message : '无法重启本机服务',
      });
    }
  };

  return { blocked, status, retry };
}
