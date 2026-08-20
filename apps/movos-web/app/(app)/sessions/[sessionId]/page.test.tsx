import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiChargingSession } from '@mediafox/shared-types';

import SessionDetailPage from './page';
import { apiClient } from '@/lib/api-client';
import * as authContext from '@/context/auth-context';

vi.mock('@/context/auth-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/context/auth-context')>();
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'session-1' }),
}));

function session(
  overrides: Partial<ApiChargingSession> = {},
): ApiChargingSession {
  return {
    id: 'session-1',
    organizationId: 'org-1',
    siteId: 'site-1',
    siteName: 'Sitio Norte',
    chargingStationId: 'cs-1',
    chargingStationName: 'Estación 1',
    evseId: 'evse-1',
    connectorId: 'connector-1',
    authorizationCredentialId: 'cred-1',
    protocolVersion: 'OCPP1_6J',
    protocolTransactionId: '42',
    status: 'ACTIVE',
    terminationReason: null,
    meterStart: 0,
    meterStop: null,
    energyWh: 5000,
    startedAt: '2026-08-19T00:00:00.000Z',
    endedAt: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAuth(role: string | null) {
  vi.mocked(authContext.useAuth).mockReturnValue({
    membership: role ? { role } : null,
  } as unknown as ReturnType<typeof authContext.useAuth>);
}

describe('SessionDetailPage — RemoteStop affordance (WO-ARGOS-064)', () => {
  it('shows "Detener carga" for an OPERATOR when the session is ACTIVE', async () => {
    mockAuth('OPERATOR');
    vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
      if (path.endsWith('/meter-values')) return Promise.resolve([]);
      return Promise.resolve(session());
    });

    render(<SessionDetailPage />);

    expect(
      await screen.findByRole('button', { name: 'Detener carga' }),
    ).toBeInTheDocument();
  });

  it('does not show "Detener carga" for a VIEWER — backend RBAC is the real boundary', async () => {
    mockAuth('VIEWER');
    vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
      if (path.endsWith('/meter-values')) return Promise.resolve([]);
      return Promise.resolve(session());
    });

    render(<SessionDetailPage />);

    await screen.findByText(/Sesión session-1/);
    expect(
      screen.queryByRole('button', { name: 'Detener carga' }),
    ).not.toBeInTheDocument();
  });

  it('does not show "Detener carga" for an already-COMPLETED session', async () => {
    mockAuth('OWNER');
    vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
      if (path.endsWith('/meter-values')) return Promise.resolve([]);
      return Promise.resolve(
        session({ status: 'COMPLETED', endedAt: '2026-08-19T01:00:00.000Z' }),
      );
    });

    render(<SessionDetailPage />);

    await screen.findByText(/Sesión session-1/);
    expect(
      screen.queryByRole('button', { name: 'Detener carga' }),
    ).not.toBeInTheDocument();
  });
});
