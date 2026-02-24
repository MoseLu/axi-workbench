import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { LoginInput, RegisterInput, User } from '@epap/schemas';
import { useLogin as useLoginMutation, useRegister as useRegisterMutation } from '@epap/api-client/hooks';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'epap_auth_token';
const REFRESH_TOKEN_KEY = 'epap_refresh_token';
const USER_KEY = 'epap_user';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const login = useCallback(async (data: LoginInput) => {
    setError(null);
    try {
      const response = await loginMutation.mutateAsync(data);
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      
      // For now, create a simple user object from email
      // In a real app, you'd fetch the user from /api/v1/auth/me
      const userData: User = {
        id: '1',
        email: data.email,
        name: data.email.split('@')[0],
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }, [loginMutation]);

  const register = useCallback(async (data: RegisterInput) => {
    setError(null);
    try {
      const response = await registerMutation.mutateAsync(data);
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      
      const userData: User = {
        id: '1',
        email: data.email,
        name: data.name,
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    }
  }, [registerMutation]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    login,
    register,
    logout,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
