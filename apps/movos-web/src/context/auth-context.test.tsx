import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@mediafox/shared-types';

import { AuthProvider, useAuth } from './auth-context';
import { apiClient } from '@/lib/api-client';
import {
  getAccessToken,
  getActiveOrganizationId,
  setAccessToken,
} from '@/lib/auth';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function Consumer() {
  const { isLoading, currentUser, logout } = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="user">{currentUser?.email ?? 'none'}</p>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function meResponse(): MeResponse {
  return {
    user: { id: 'u1', email: 'operator@kylum.com' } as MeResponse['user'],
    organizations: [
      { id: 'org-1', name: 'Kylum Energy' },
    ] as MeResponse['organizations'],
    memberships: [{ role: 'OWNER' }] as MeResponse['memberships'],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  replaceMock.mockClear();
  document.cookie = 'movos_session=; path=/; max-age=0';
});

describe('AuthProvider — hard refresh rehydration', () => {
  it('a valid refresh cookie rehydrates the session on mount, without waiting for any widget', async () => {
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue('fresh-token');
    vi.spyOn(apiClient, 'get').mockResolvedValue(meResponse());

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('operator@kylum.com');
    expect(document.cookie).toContain('movos_session=1');
  });

  it('a failed restore reaches isLoading=false with no user, and clears the session cookie', async () => {
    document.cookie = 'movos_session=1; path=/; max-age=999999';
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue(null);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(document.cookie).not.toContain('movos_session=1');
  });
});

describe('AuthProvider — logout after a degraded state', () => {
  it('clears token, org id, cookie, and React state, and navigates via SPA replace (not window.location)', async () => {
    // Simulate a degraded state left over from a failed concurrent-refresh
    // race: a stale in-memory token/org id from before things went wrong.
    setAccessToken('stale-token');
    document.cookie = 'movos_session=1; path=/; max-age=999999';
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue(null);
    vi.spyOn(apiClient, 'post').mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );

    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(getAccessToken()).toBeNull();
    expect(getActiveOrganizationId()).toBeNull();
    expect(document.cookie).not.toContain('movos_session=1');
  });
});
