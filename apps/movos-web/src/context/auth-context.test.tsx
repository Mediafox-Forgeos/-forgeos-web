import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ApiMembership,
  ApiOrganization,
  ApiUser,
} from '@mediafox/shared-types';

import { AuthProvider, useAuth } from './auth-context';
import { apiClient } from '@/lib/api-client';
import { clearAuth, getActiveOrganizationId } from '@/lib/auth';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

function user(): ApiUser {
  return {
    id: 'u1',
    email: 'admin@kylum.co',
    displayName: 'Admin',
    status: 'ACTIVE',
  };
}

function org(id: string, name: string): ApiOrganization {
  return { id, name, slug: name.toLowerCase(), status: 'ACTIVE' };
}

function membership(organizationId: string): ApiMembership {
  return {
    id: `m-${organizationId}`,
    organizationId,
    role: 'OWNER',
    status: 'ACTIVE',
  };
}

// Exposes AuthContext state as text so assertions can read it without
// reaching into React internals.
function Probe() {
  const { currentUser, currentOrg, organizations, needsOrganizationSelection } =
    useAuth();
  return (
    <div>
      <span data-testid="user">{currentUser?.email ?? 'none'}</span>
      <span data-testid="org">{currentOrg?.id ?? 'none'}</span>
      <span data-testid="org-count">{organizations.length}</span>
      <span data-testid="needs-selection">
        {String(needsOrganizationSelection)}
      </span>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  clearAuth();
  window.sessionStorage.clear();
});

describe('AuthProvider session restore (mount)', () => {
  it('does not select any organization when the refresh cookie is absent (logged out)', async () => {
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('none'),
    );
    expect(screen.getByTestId('needs-selection')).toHaveTextContent('false');
  });

  // DEC-022: the restored session's active organization must be whichever
  // one the backend says the token is bound to — never organizations[0].
  it('restores the organization the backend says the token is bound to, not the first in the list', async () => {
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue('new-token');
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      organizationId: 'o2',
      user: user(),
      organizations: [org('o1', 'Alpha'), org('o2', 'Beta')],
      memberships: [membership('o1'), membership('o2')],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('org')).toHaveTextContent('o2'),
    );
    expect(getActiveOrganizationId()).toBe('o2');
    expect(screen.getByTestId('needs-selection')).toHaveTextContent('false');
  });

  // Case B (WO-ARGOS-015 Objective 3): a null organizationId (0 or >1
  // ACTIVE memberships) must never fall back to organizations[0] — it must
  // surface as "needs an explicit selection".
  it('leaves the organization unset and flags needsOrganizationSelection for a pre-selection token', async () => {
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue('new-token');
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      organizationId: null,
      user: user(),
      organizations: [org('o1', 'Alpha'), org('o2', 'Beta')],
      memberships: [membership('o1'), membership('o2')],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('org-count')).toHaveTextContent('2'),
    );
    expect(screen.getByTestId('org')).toHaveTextContent('none');
    expect(screen.getByTestId('needs-selection')).toHaveTextContent('true');
    expect(getActiveOrganizationId()).toBeNull();
  });
});

describe('AuthProvider.login', () => {
  it('applies the organization the backend auto-selected, without any local fallback logic', async () => {
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue(null);
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      accessToken: 'token',
      organizationId: 'o1',
      user: user(),
      organizations: [org('o1', 'Alpha')],
      memberships: [membership('o1')],
    });

    function LoginProbe() {
      const auth = useAuth();
      return (
        <div>
          <button onClick={() => void auth.login('a@b.co', 'pw')}>login</button>
          <Probe />
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('none'),
    );

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/auth/login',
      { email: 'a@b.co', password: 'pw' },
      { skipRefresh: true },
    );
    expect(screen.getByTestId('org')).toHaveTextContent('o1');
  });
});

describe('AuthProvider.selectOrganization', () => {
  it('mints a new token and switches currentOrg', async () => {
    vi.spyOn(apiClient, 'attemptRefresh').mockResolvedValue('t');
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      organizationId: null,
      user: user(),
      organizations: [org('o1', 'Alpha'), org('o2', 'Beta')],
      memberships: [membership('o1'), membership('o2')],
    });
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ accessToken: 'scoped-token', organizationId: 'o2' });

    function SelectProbe() {
      const auth = useAuth();
      return (
        <div>
          <button onClick={() => void auth.selectOrganization('o2')}>
            select
          </button>
          <Probe />
        </div>
      );
    }

    render(
      <AuthProvider>
        <SelectProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('needs-selection')).toHaveTextContent('true'),
    );

    await act(async () => {
      screen.getByText('select').click();
    });

    expect(postSpy).toHaveBeenCalledWith('/auth/select-organization', {
      organizationId: 'o2',
    });
    expect(screen.getByTestId('org')).toHaveTextContent('o2');
    expect(screen.getByTestId('needs-selection')).toHaveTextContent('false');
    expect(getActiveOrganizationId()).toBe('o2');
  });
});
