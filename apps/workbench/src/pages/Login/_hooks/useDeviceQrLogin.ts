/**
 * 工作台登录页 — 电脑端扫码登录（Web Device Login QR）。
 *
 * 从原 Login.tsx 组件体搬出两个 effect 与刷新动作：
 *  1. 首次进入即创建二维码（凭证只留在内存）；
 *  2. 轮询状态，approved 后 consume 并 refreshSession 建立电脑会话。
 * 二维码始终在左侧启动，与登录面切换无关。
 */
import { useEffect, useRef, useState } from 'react';
import {
  consumeWebDeviceLoginQr,
  createWebDeviceLoginQr,
  getWebDeviceLoginQrStatus,
  type WebDeviceLoginQr,
} from '../../../lib/webDeviceLogin';
import type { DeviceQrStatus } from '../_components/QrLoginPanel';

const QR_POLL_INTERVAL_MS = 3_000;

export interface DeviceQrLoginState {
  deviceQr: WebDeviceLoginQr | null;
  status: DeviceQrStatus;
  error: string | null;
  /** approved 后 consume + refreshSession 期间为 true（仅用于内部并发保护）。 */
  submitting: boolean;
  refresh: () => void;
}

export function useDeviceQrLogin(refreshSession: () => Promise<boolean>): DeviceQrLoginState {
  const [deviceQr, setDeviceQr] = useState<WebDeviceLoginQr | null>(null);
  const [status, setStatus] = useState<DeviceQrStatus>('creating');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const creatingRef = useRef(false);
  const consumingRef = useRef(false);

  // 二维码始终在左侧启动；其轮询凭证只留在内存中。
  useEffect(() => {
    if (deviceQr || creatingRef.current) return undefined;
    if (status === 'failed') return undefined;
    creatingRef.current = true;
    setStatus('creating');
    setError(null);
    void createWebDeviceLoginQr()
      .then((created) => {
        setDeviceQr(created);
        setStatus('waiting_scan');
      })
      .catch((cause: unknown) => {
        setStatus('failed');
        setError(cause instanceof Error ? cause.message : '无法生成电脑登录二维码');
      })
      .finally(() => {
        creatingRef.current = false;
      });
    return undefined;
  }, [deviceQr, status]);

  useEffect(() => {
    if (!deviceQr || status === 'expired' || status === 'failed') return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getWebDeviceLoginQrStatus(deviceQr);
        if (cancelled) return;
        if (next.status === 'expired' || next.status === 'consumed') {
          setStatus('expired');
          if (next.status === 'expired') setError('二维码已过期，正在自动更新。');
          return;
        }
        setStatus(next.status);
        if (next.status !== 'approved' || consumingRef.current) return;

        consumingRef.current = true;
        setSubmitting(true);
        try {
          await consumeWebDeviceLoginQr(deviceQr);
          const authenticated = await refreshSession();
          if (!authenticated) throw new Error('电脑会话未建立，正在自动更新二维码。');
        } catch (cause: unknown) {
          if (!cancelled) {
            setStatus('failed');
            setError(cause instanceof Error ? cause.message : '手机授权后无法建立电脑会话');
          }
        } finally {
          if (!cancelled) setSubmitting(false);
        }
      } catch (cause: unknown) {
        if (!cancelled) {
          setStatus('failed');
          setError(cause instanceof Error ? cause.message : '无法读取电脑登录二维码状态');
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), QR_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [deviceQr, status, refreshSession]);

  const refresh = () => {
    consumingRef.current = false;
    setDeviceQr(null);
    setStatus('creating');
    setError(null);
  };

  return { deviceQr, status, error, submitting, refresh };
}
