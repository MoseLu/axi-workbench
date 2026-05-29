/**
 * 认证 Context
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import apiClient from '../api/client';

interface AuthValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<unknown>;
}

const AuthContext = createContext<AuthValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sop_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 检查现有登录状态
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient.getMe()
      .then(u => { setUser(u as User); setError(null); })
      .catch(() => { setUser(null); setToken(null); localStorage.removeItem('sop_token'); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = await apiClient.login(username, password) as LoginResult;
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem('sop_token', result.token);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sop_token');
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    return apiClient.changePassword(oldPassword, newPassword);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
