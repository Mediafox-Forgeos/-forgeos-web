'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import type {
  ApiMembership,
  ApiOrganization,
  ApiUser,
  LoginResponse,
  MeResponse,
} from '@mediafox/shared-types';

import { apiClient, ApiError } from '@/lib/api-client';
import { clearAuth, setAccessToken, setActiveOrganizationId } from '@/lib/auth';

const SESSION_COOKIE = 'movos_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function setSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax; Secure`;
}

function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax; Secure`;
}

interface AuthContextValue {
  currentUser: ApiUser | null;
  currentOrg: ApiOrganization | null;
  membership: ApiMembership | null;
  organizations: ApiOrganization[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(null);
  const [organizations, setOrganizations] = React.useState<ApiOrganization[]>(
    [],
  );
  const [memberships, setMemberships] = React.useState<ApiMembership[]>([]);
  const [currentOrg, setCurrentOrg] = React.useState<ApiOrganization | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const applySession = React.useCallback(
    (data: {
      user: ApiUser;
      organizations: ApiOrganization[];
      memberships: ApiMembership[];
    }) => {
      setCurrentUser(data.user);
      setOrganizations(data.organizations);
      setMemberships(data.memberships);
      const firstOrg = data.organizations[0] ?? null;
      setCurrentOrg(firstOrg);
      setActiveOrganizationId(firstOrg?.id ?? null);
    },
    [],
  );

  const resetSession = React.useCallback(() => {
    setCurrentUser(null);
    setOrganizations([]);
    setMemberships([]);
    setCurrentOrg(null);
    clearAuth();
  }, []);

  // On mount, try to restore the session using the httpOnly refresh cookie.
  React.useEffect(() => {
    let cancelled = false;
    async function restore(): Promise<void> {
      const token = await apiClient.attemptRefresh();
      if (!token) {
        if (!cancelled) {
          clearSessionCookie();
          setIsLoading(false);
        }
        return;
      }
      try {
        const me = await apiClient.get<MeResponse>('/auth/me');
        if (!cancelled) {
          setSessionCookie();
          applySession(me);
        }
      } catch {
        if (!cancelled) {
          clearSessionCookie();
          resetSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [applySession, resetSession]);

  const login = React.useCallback(
    async (email: string, password: string): Promise<void> => {
      const data = await apiClient.post<LoginResponse>(
        '/auth/login',
        { email, password },
        { skipRefresh: true, skipOrgHeader: true },
      );
      setAccessToken(data.accessToken);
      setSessionCookie();
      applySession(data);
    },
    [applySession],
  );

  const logout = React.useCallback(async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
    } finally {
      clearSessionCookie();
      resetSession();
      router.replace('/login');
    }
  }, [resetSession, router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      currentUser,
      currentOrg,
      membership: memberships[0] ?? null,
      organizations,
      isLoading,
      login,
      logout,
    }),
    [
      currentUser,
      currentOrg,
      memberships,
      organizations,
      isLoading,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
