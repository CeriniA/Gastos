import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, LoginResult } from '@gastos/shared';
import { api, onUnauthorized, tokenStore } from '../../shared/api/client';
import { queryClient } from '../../shared/api/queryClient';

interface AuthValue {
  isAuthenticated: boolean;
  login(input: LoginInput): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setAuthenticated(false);
  }, []);

  // The server rejected the token (expired or changed secret): back to login.
  useEffect(() => onUnauthorized(logout), [logout]);

  const login = useCallback(async (input: LoginInput) => {
    const result = await api<LoginResult>('/auth/login', { method: 'POST', body: input });
    tokenStore.set(result.token);
    setAuthenticated(true);
  }, []);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
