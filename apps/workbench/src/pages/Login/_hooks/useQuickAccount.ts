/**
 * 工作台登录页 — 最近账号（一键登录候选）状态。
 *
 * 从原 Login.tsx 组件体搬出：
 *  - 已登录用户回到 /login 时写入最近账号并优先切到 quick 面；
 *  - 未登录时的静默 resume 探测（VITE_DISABLE_SESSION_PROBE=1 可关闭）。
 * 快捷登录必须先经过原生/浏览器会话探测，不能用本地缓存的账号信息
 * 直接渲染一个可能必然失败的“一键登录”入口。
 */
import { useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { User } from '@axi/workstation-contracts';
import { resolveGatewayURL, resolveUsername } from '@axi/workbench-foundation';
import { backoffFetch } from '../../../lib/network/backoffFetch';
import {
  getOrCreateDeviceId,
  readLastAccount,
  writeLastAccount,
  type LastAccount,
} from '../../../lib/lastAccount';
import type { LoginSurface } from './types';

export interface UseQuickAccountOptions {
  user: User | null;
  setLoginSurface: Dispatch<SetStateAction<LoginSurface>>;
  otherMethodsRef: MutableRefObject<boolean>;
  formLoginRef: MutableRefObject<boolean>;
}

export interface QuickAccountState {
  quickAccount: LastAccount | null;
  setQuickAccount: Dispatch<SetStateAction<LastAccount | null>>;
}

export function useQuickAccount({
  user,
  setLoginSurface,
  otherMethodsRef,
  formLoginRef,
}: UseQuickAccountOptions): QuickAccountState {
  const [quickAccount, setQuickAccount] = useState<LastAccount | null>(() => readLastAccount());

  useEffect(() => {
    if (!user) return;
    const existing = readLastAccount();
    setQuickAccount(writeLastAccount({
      subject: user.id,
      name: existing?.subject === user.id ? existing.name : user.name,
      email: user.email,
    }));
    if (!otherMethodsRef.current && !formLoginRef.current) {
      setLoginSurface((current) => (current === 'qr' ? current : 'quick'));
    }
  }, [user]);

  useEffect(() => {
    // Silent resume probe — cosmetic convenience only. VITE_DISABLE_SESSION_PROBE=1
    // skips it entirely (useful when the gateway is known to be down).
    if (import.meta.env.VITE_DISABLE_SESSION_PROBE === '1') return;
    const deviceId = getOrCreateDeviceId();
    const controller = new AbortController();
    void backoffFetch(resolveGatewayURL('/api/v1/sessions/resume'), {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Axi-Device-Id': deviceId },
      signal: controller.signal,
      backoff: { maxRetries: 2, baseDelayMs: 1000 },
    }).then(async (response) => {
      if (!response.ok) {
        setQuickAccount(null);
        if (!otherMethodsRef.current) setLoginSurface('account');
        return;
      }
      const body = (await response.json()) as { resumable?: boolean; user?: { subject?: string; email?: string; name?: string } };
      if (!body.resumable || !body.user?.subject) {
        setQuickAccount(null);
        if (!otherMethodsRef.current) setLoginSurface('account');
        return;
      }
      const existing = readLastAccount();
      const account = writeLastAccount({
        subject: body.user.subject,
        name: existing?.subject === body.user.subject
          ? existing.name
          : resolveUsername({
            candidate: body.user.name,
            email: body.user.email,
            subject: body.user.subject,
          }),
        email: body.user.email,
      });
      setQuickAccount(account);
      if (!otherMethodsRef.current) setLoginSurface('quick');
    }).catch(() => {
      setQuickAccount(null);
      if (!otherMethodsRef.current) setLoginSurface('account');
    });
    return () => controller.abort();
  }, []);

  return { quickAccount, setQuickAccount };
}
