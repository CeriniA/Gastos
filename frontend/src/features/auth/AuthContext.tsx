import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, LoginResult, SessionInfo } from '@gastos/shared';
import { api, onUnauthorized, tokenStore } from '../../shared/api/client';
import { queryClient } from '../../shared/api/queryClient';

interface AuthValue {
  isAuthenticated: boolean;
  /** Who is signed in, once the server said so. Undefined while it is being asked. */
  session: SessionInfo | undefined;
  login(input: LoginInput): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(() => tokenStore.get() !== null);
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<SessionInfo>('/auth/me'),
    enabled: isAuthenticated,
  }).data;

  const logout = useCallback(() => {
    tokenStore.clear();
    // Whatever was on screen belonged to whoever was signed in.
    queryClient.clear();
    setAuthenticated(false);
  }, []);

  // The server rejected the token (expired, closed or changed secret): back to login.
  useEffect(() => onUnauthorized(logout), [logout]);

  const login = useCallback(async (input: LoginInput) => {
    const result = await api<LoginResult>('/auth/login', { method: 'POST', body: input });
    queryClient.clear();
    tokenStore.set(result.token);
    setAuthenticated(true);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, session: isAuthenticated ? session : undefined, login, logout }),
    [isAuthenticated, session, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
