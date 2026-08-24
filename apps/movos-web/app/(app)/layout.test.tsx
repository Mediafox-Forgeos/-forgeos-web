import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiUser } from '@mediafox/shared-types';

import AppLayout from './layout';
import * as authContext from '@/context/auth-context';

const replaceMock = vi.fn();

vi.mock('@/context/auth-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/context/auth-context')>();
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

// The shell renders a real sidebar with its own data dependencies — replace
// it with a trivial marker so this test is only about the auth gate itself.
vi.mock('@/components/layout/movos-shell', () => ({
  MovosShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="movos-shell">{children}</div>
  ),
}));

function mockAuth(overrides: {
  isLoading: boolean;
  currentUser: ApiUser | null;
}) {
  vi.mocked(authContext.useAuth).mockReturnValue({
    ...overrides,
    currentOrg: null,
    membership: null,
    organizations: [],
    login: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof authContext.useAuth>);
}

afterEach(() => {
  vi.restoreAllMocks();
  replaceMock.mockClear();
});

describe('AppLayout — auth ready gate', () => {
  it('does not render authenticated children while restore() is still loading', () => {
    mockAuth({ isLoading: true, currentUser: null });

    render(
      <AppLayout>
        <div data-testid="protected-content">secret</div>
      </AppLayout>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('movos-shell')).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('renders the authenticated app exactly once restore() succeeds', () => {
    mockAuth({
      isLoading: false,
      currentUser: { id: 'u1', email: 'a@b.com' } as ApiUser,
    });

    render(
      <AppLayout>
        <div data-testid="protected-content">secret</div>
      </AppLayout>,
    );

    expect(screen.getByTestId('movos-shell')).toBeInTheDocument();
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects to /login and never renders protected children when restore() fails', () => {
    mockAuth({ isLoading: false, currentUser: null });

    render(
      <AppLayout>
        <div data-testid="protected-content">secret</div>
      </AppLayout>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith('/login');
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});
