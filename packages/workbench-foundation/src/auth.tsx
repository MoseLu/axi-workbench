import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@axi/workstation-contracts';

type GatewaySessionResponse = {
  authenticated: boolean;
  user?: {
    subject: string;
    email?: string;
    name?: string;
  };
};

type RequestEmailCodeResponse = {
  challengeId?: string;
  expiresAt?: string;
};

type LoginEmailConfirmResponse = {
  authenticated: boolean;
  user?: {
    subject: string;
    email?: string;
    name?: string;
  };
};

const EMAIL_LOGIN_PURPOSE = 'login';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  beginLogin: (returnTo?: string) => void;
  refreshSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  requestEmailCode: (email: string) => Promise<{ challengeId: string; expiresAt: string }>;
  confirmEmailCode: (challengeId: string, token: string) => Promise<boolean>;
}

export interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

/**
 * Keeps browser-session cookies first-party during local development.
 *
 * Any loopback gateway is served through Vite's same-origin /api proxy during
 * local development. That avoids browser session-cookie differences across
 * loopback hostnames, ports, and schemes without changing deployed URLs.
 */
export function normalizeGatewayBaseURL(configuredBaseURL: string, browserOrigin?: string): string {
  const baseURL = configuredBaseURL.replace(/\/$/, '');
  if (!baseURL || !browserOrigin) return baseURL;

  try {
    const gatewayURL = new URL(baseURL);
    const pageURL = new URL(browserOrigin);
    const isLoopbackPair = isLoopbackHostname(gatewayURL.hostname)
      && isLoopbackHostname(pageURL.hostname);
    return isLoopbackPair ? '' : baseURL;
  } catch {
    // An invalid configured URL should retain the existing request behavior
    // and surface through fetch rather than failing module initialization.
    return baseURL;
  }
}

const gatewayBaseURL = normalizeGatewayBaseURL(
  metaEnv.VITE_API_BASE_URL || '',
  typeof window === 'undefined' ? undefined : window.location.origin,
);

/** Resolve a gateway path for either a same-origin local app or a deployed client. */
export function resolveGatewayURL(path: string): string {
  return `${gatewayBaseURL}${path}`;
}

function mapGatewayUser(value: NonNullable<GatewaySessionResponse['user']>): User {
  const displayName = value.name?.trim() || value.email?.split('@')[0] || value.subject;
  const now = new Date();
  return {
    id: value.subject,
    email: value.email || '',
    name: displayName,
    role: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function defaultCallbackURL(): string {
  if (typeof window === 'undefined') return '/auth/callback';
  return new URL('/auth/callback', window.location.origin).toString();
}

function safeLocalPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.clone().json()) as { error?: string; detail?: string };
    if (data?.error && data?.detail) return `${data.error}: ${data.detail}`;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
  } catch {
    // ignore — fall back to text body
  }
  try {
    const text = (await response.text()).trim();
    return text;
  } catch {
    return '';
  }
}

/**
 * Shared authentication protocol for the independent Web and mobile apps.
 * The browser only carries an HttpOnly gateway session cookie; it never stores
 * an access token, refresh token, OIDC code, or QR credential in JavaScript.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(resolveGatewayURL('/api/v1/auth/session'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        setUser(null);
        return false;
      }
      const session = (await response.json()) as GatewaySessionResponse;
      if (!session.authenticated || !session.user?.subject) {
        setUser(null);
        return false;
      }
      setUser(mapGatewayUser(session.user));
      setError(null);
      return true;
    } catch (caught: unknown) {
      setUser(null);
      setError(caught instanceof Error ? caught.message : 'Unable to restore Axi session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const beginLogin = useCallback((returnTo?: string) => {
    if (typeof window === 'undefined') return;
    const destination = safeLocalPath(returnTo);
    window.sessionStorage.setItem('axi.auth.return-to', destination);
    window.location.assign(resolveGatewayURL(`/api/v1/auth/oidc/start?return_to=${encodeURIComponent(defaultCallbackURL())}`));
  }, []);

  const requestEmailCode = useCallback(async (email: string): Promise<{ challengeId: string; expiresAt: string }> => {
    const trimmed = email.trim();
    if (!trimmed) {
      const message = '请输入邮箱地址';
      setError(message);
      throw new Error(message);
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(resolveGatewayURL('/api/v1/auth/email-verifications'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: trimmed, purpose: EMAIL_LOGIN_PURPOSE }),
      });
      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(detail || `发送验证码失败 (HTTP ${response.status})`);
      }
      const body = (await response.json().catch(() => ({}))) as RequestEmailCodeResponse;
      if (!body.challengeId) throw new Error('验证码挑战未创建，请稍后重试');
      return { challengeId: body.challengeId, expiresAt: body.expiresAt ?? '' };
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : '无法发送验证码';
      setError(message);
      throw caught instanceof Error ? caught : new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmEmailCode = useCallback(async (challengeId: string, token: string): Promise<boolean> => {
    const challenge = challengeId.trim();
    const trimmed = token.trim();
    if (!challenge || !/^\d{6}$/.test(trimmed)) {
      const message = '请输入有效的验证码';
      setError(message);
      return false;
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(resolveGatewayURL('/api/v1/auth/login/email/confirm'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ challengeId: challenge, token: trimmed }),
      });
      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(detail || `验证码无效或已过期 (HTTP ${response.status})`);
      }
      const body = (await response.json().catch(() => null)) as LoginEmailConfirmResponse | null;
      if (!body || body.authenticated !== true) {
        throw new Error('身份适配器未确认会话');
      }
      // Refresh the session cookie into the React state so the protected routes unlock.
      const authenticated = await refreshSession();
      if (!authenticated) throw new Error('会话未建立，请重新验证验证码');
      return authenticated;
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : '验证失败';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await fetch(resolveGatewayURL('/api/v1/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setError(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('axi.auth.return-to');
      }
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    beginLogin,
    refreshSession,
    requestEmailCode,
    confirmEmailCode,
    logout,
  }), [beginLogin, confirmEmailCode, error, isLoading, logout, refreshSession, requestEmailCode, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
