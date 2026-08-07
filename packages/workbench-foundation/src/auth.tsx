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

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  beginLogin: (returnTo?: string) => void;
  refreshSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
const gatewayBaseURL = (metaEnv.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
    logout,
  }), [beginLogin, error, isLoading, logout, refreshSession, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
