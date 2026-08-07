import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput, User } from '@axi/workstation-contracts';
import { useLogin as useLoginMutation, useRegister as useRegisterMutation } from '@epap/api-client';

/**
 * 两个独立应用共享同一份认证协议与存储键。
 *
 * 存储仍受浏览器 origin 隔离；跨域单点登录由 auth-service 的 cookie / token
 * 合同负责，而不是由一个 React 壳跨端偷读 localStorage。
 */
export const WORKBENCH_SESSION_KEYS = {
  accessToken: 'epap_auth_token',
  refreshToken: 'epap_refresh_token',
  user: 'epap_user',
} as const;

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  error: string | null;
}

export interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readPersistedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedUser = window.localStorage.getItem(WORKBENCH_SESSION_KEYS.user);
    return savedUser ? (JSON.parse(savedUser) as User) : null;
  } catch {
    window.localStorage.removeItem(WORKBENCH_SESSION_KEYS.user);
    return null;
  }
}

function persistSession(tokens: { accessToken: string; refreshToken: string }, user: User) {
  window.localStorage.setItem(WORKBENCH_SESSION_KEYS.accessToken, tokens.accessToken);
  window.localStorage.setItem(WORKBENCH_SESSION_KEYS.refreshToken, tokens.refreshToken);
  window.localStorage.setItem(WORKBENCH_SESSION_KEYS.user, JSON.stringify(user));
}

function buildUser(data: Pick<LoginInput, 'email'> & Partial<Pick<RegisterInput, 'name'>>): User {
  return {
    id: '1',
    email: data.email,
    name: data.name || data.email.split('@')[0] || data.email,
    role: 'user',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(readPersistedUser);
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const login = useCallback(
    async (data: LoginInput) => {
      setError(null);
      try {
        const response = await loginMutation.mutateAsync(data);
        const nextUser = buildUser(data);
        persistSession(response, nextUser);
        setUser(nextUser);
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : 'Login failed';
        setError(message);
        throw caught;
      }
    },
    [loginMutation],
  );

  const register = useCallback(
    async (data: RegisterInput) => {
      setError(null);
      try {
        const response = await registerMutation.mutateAsync(data);
        const nextUser = buildUser(data);
        persistSession(response, nextUser);
        setUser(nextUser);
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : 'Registration failed';
        setError(message);
        throw caught;
      }
    },
    [registerMutation],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(WORKBENCH_SESSION_KEYS.accessToken);
    window.localStorage.removeItem(WORKBENCH_SESSION_KEYS.refreshToken);
    window.localStorage.removeItem(WORKBENCH_SESSION_KEYS.user);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading: loginMutation.isPending || registerMutation.isPending,
        login,
        register,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
