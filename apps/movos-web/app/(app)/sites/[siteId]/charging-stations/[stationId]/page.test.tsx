import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiChargingStation } from '@mediafox/shared-types';

import ChargingStationDetailPage from './page';
import { apiClient, ApiError } from '@/lib/api-client';
import * as chargingApi from '@/lib/charging-api';
import * as authContext from '@/context/auth-context';

vi.mock('@/context/auth-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/context/auth-context')>();
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ siteId: 'site-1', stationId: 'cs-1' }),
}));

function station(
  overrides: Partial<ApiChargingStation> = {},
): ApiChargingStation {
  return {
    id: 'cs-1',
    siteId: 'site-1',
    name: 'Calima – Digital Twin 01',
    code: 'DT-CALIMA-01',
    manufacturer: null,
    model: null,
    serialNumber: null,
    protocol: 'OCPP1_6J',
    status: 'ACTIVE',
    commissionedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    connectivityStatus: 'OFFLINE',
    lastConnectedAt: '2026-08-17T01:18:00.000Z',
    lastDisconnectedAt: null,
    lastSeenAt: '2026-08-17T01:18:00.000Z',
    lastProtocolVersion: 'OCPP1_6J',
    ...overrides,
  };
}

function mockAuth(role: string | null) {
  vi.mocked(authContext.useAuth).mockReturnValue({
    membership: role ? { role } : null,
  } as unknown as ReturnType<typeof authContext.useAuth>);
}

/** Only the station load matters for these tests — site/sessions/work-orders
 * are optional enrichment (the page swallows their errors), so reject them
 * to keep each test focused. */
function mockSupportingCalls(): void {
  vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiError(404, 'n/a'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChargingStationDetailPage — OCPP credential actions RBAC', () => {
  it('shows both "Aprovisionar OCPP" and "Rotar credenciales OCPP" for OWNER', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());

    render(<ChargingStationDetailPage />);

    expect(
      await screen.findByRole('button', { name: 'Aprovisionar OCPP' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rotar credenciales OCPP' }),
    ).toBeInTheDocument();
  });

  it('shows both OCPP actions for ADMIN', async () => {
    mockAuth('ADMIN');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());

    render(<ChargingStationDetailPage />);

    expect(
      await screen.findByRole('button', { name: 'Aprovisionar OCPP' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rotar credenciales OCPP' }),
    ).toBeInTheDocument();
  });

  it('does not show any OCPP action for OPERATOR — backend RBAC is OWNER/ADMIN only', async () => {
    mockAuth('OPERATOR');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());

    render(<ChargingStationDetailPage />);

    await screen.findByRole('heading', { name: 'Calima – Digital Twin 01' });
    expect(
      screen.queryByRole('button', { name: 'Aprovisionar OCPP' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Rotar credenciales OCPP' }),
    ).not.toBeInTheDocument();
  });

  it('does not show any OCPP action for VIEWER', async () => {
    mockAuth('VIEWER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());

    render(<ChargingStationDetailPage />);

    await screen.findByRole('heading', { name: 'Calima – Digital Twin 01' });
    expect(
      screen.queryByRole('button', { name: 'Aprovisionar OCPP' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Rotar credenciales OCPP' }),
    ).not.toBeInTheDocument();
  });
});

describe('ChargingStationDetailPage — credential rotation flow', () => {
  it('clicking "Rotar credenciales OCPP" opens confirmation without calling the API yet', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    const rotateSpy = vi.spyOn(chargingApi, 'rotateOcppCredentials');
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Rotar credenciales OCPP',
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('DT-CALIMA-01')).toBeInTheDocument();
    expect(rotateSpy).not.toHaveBeenCalled();
  });

  it('"Cancelar" closes the dialog without calling the API', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    const rotateSpy = vi.spyOn(chargingApi, 'rotateOcppCredentials');
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(rotateSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('dialog', { name: 'Rotar credenciales OCPP' }),
    ).not.toBeInTheDocument();
  });

  it('confirming triggers exactly one request', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    const rotateSpy = vi
      .spyOn(chargingApi, 'rotateOcppCredentials')
      .mockResolvedValue({
        ocppIdentity: 'movos-abcd1234',
        plaintextSecret: 'new-secret-value',
      });
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rotar credenciales' }),
    );

    await waitFor(() => expect(rotateSpy).toHaveBeenCalledTimes(1));
    expect(rotateSpy).toHaveBeenCalledWith('cs-1');
  });

  it('does not allow a double submit while the request is in flight', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    let resolveRotate: (v: chargingApi.OcppProvisioningResult) => void;
    const rotateSpy = vi
      .spyOn(chargingApi, 'rotateOcppCredentials')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRotate = resolve;
          }),
      );
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    const confirmButton = screen.getByRole('button', {
      name: 'Rotar credenciales',
    });
    await user.click(confirmButton);
    // Button now reads "Rotando…" and is disabled — a second click must not
    // fire a second request.
    await user.click(screen.getByRole('button', { name: 'Rotando…' }));

    expect(rotateSpy).toHaveBeenCalledTimes(1);
    resolveRotate!({
      ocppIdentity: 'movos-abcd1234',
      plaintextSecret: 'new-secret-value',
    });
    await screen.findByRole('dialog', { name: 'Credenciales OCPP rotadas' });
  });

  it('success shows the identity and the one-time secret, with the once-only warning', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'rotateOcppCredentials').mockResolvedValue({
      ocppIdentity: 'movos-abcd1234',
      plaintextSecret: 'new-secret-value',
    });
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rotar credenciales' }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Credenciales OCPP rotadas' }),
    ).toBeInTheDocument();
    expect(screen.getByText('movos-abcd1234')).toBeInTheDocument();
    expect(screen.getByText('new-secret-value')).toBeInTheDocument();
    expect(
      screen.getByText(/Este secreto se muestra una sola vez/),
    ).toBeInTheDocument();
  });

  it('closing the result modal removes the secret from the DOM', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'rotateOcppCredentials').mockResolvedValue({
      ocppIdentity: 'movos-abcd1234',
      plaintextSecret: 'new-secret-value',
    });
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rotar credenciales' }),
    );
    await screen.findByText('new-secret-value');

    await user.click(
      screen.getByRole('button', { name: 'Ya copié ambos valores' }),
    );

    expect(screen.queryByText('new-secret-value')).not.toBeInTheDocument();
  });

  it('represents a 403 honestly, using the backend message', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'rotateOcppCredentials').mockRejectedValue(
      new ApiError(
        403,
        'No tienes permisos para administrar credenciales OCPP.',
      ),
    );
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rotar credenciales' }),
    );

    expect(
      await screen.findByText(
        'No tienes permisos para administrar credenciales OCPP.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Credenciales OCPP rotadas' }),
    ).not.toBeInTheDocument();
  });

  it('represents a 404 (not provisioned) honestly, using the backend message', async () => {
    mockAuth('ADMIN');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'rotateOcppCredentials').mockRejectedValue(
      new ApiError(
        404,
        'Esta estación de carga no ha sido provisionada para OCPP todavía.',
      ),
    );
    const provisionSpy = vi.spyOn(chargingApi, 'provisionOcppCredentials');
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rotar credenciales' }),
    );

    expect(
      await screen.findByText(
        'Esta estación de carga no ha sido provisionada para OCPP todavía.',
      ),
    ).toBeInTheDocument();
    // No automatic fallback mutation — the provision button is unaffected,
    // and no provisioning call happens on its own.
    expect(provisionSpy).not.toHaveBeenCalled();
  });

  it('a 5xx does not fabricate success', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'rotateOcppCredentials').mockRejectedValue(
      new Error('network exploded'),
    );
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Rotar credenciales OCPP' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Rotar credenciales' }),
    );

    expect(
      await screen.findByText(
        'No fue posible rotar las credenciales OCPP. Intenta nuevamente.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Credenciales OCPP rotadas' }),
    ).not.toBeInTheDocument();
  });
});

describe('ChargingStationDetailPage — existing OCPP provisioning flow stays green', () => {
  it('OWNER provisioning still shows the identity and one-time secret', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'provisionOcppCredentials').mockResolvedValue({
      ocppIdentity: 'movos-newid01',
      plaintextSecret: 'first-secret-value',
    });
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Aprovisionar OCPP' }),
    );

    expect(
      await screen.findByRole('dialog', {
        name: 'Estación aprovisionada para OCPP',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('movos-newid01')).toBeInTheDocument();
    expect(screen.getByText('first-secret-value')).toBeInTheDocument();
  });

  it('provisioning error still surfaces inline below the header', async () => {
    mockAuth('OWNER');
    mockSupportingCalls();
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(chargingApi, 'provisionOcppCredentials').mockRejectedValue(
      new ApiError(
        409,
        'Esta estación de carga ya tiene una identidad OCPP asignada. Usa la rotación de secreto en lugar de re-provisionar.',
      ),
    );
    const user = userEvent.setup();

    render(<ChargingStationDetailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Aprovisionar OCPP' }),
    );

    expect(
      await screen.findByText(
        'Esta estación de carga ya tiene una identidad OCPP asignada. Usa la rotación de secreto en lugar de re-provisionar.',
      ),
    ).toBeInTheDocument();
  });
});

// WO-ARGOS-090 §12, §14.22/§14.23 — station detail must let an operator
// distinguish a resolved historical incident from an active one, with real
// timestamps, not just a same-looking list of titles.
describe('ChargingStationDetailPage — WorkOrder history', () => {
  it('distinguishes an active connectivity incident from an already-resolved one, with timestamps', async () => {
    mockAuth('OWNER');
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/work-orders') {
        return [
          {
            id: 'wo-open',
            title: 'Estación sin conexión: Calima – Digital Twin 01',
            status: 'OPEN',
            priority: 'HIGH',
            source: 'CONNECTIVITY_LOSS',
            stationId: 'cs-1',
            stationName: 'Calima – Digital Twin 01',
            assignedMemberId: null,
            assignedMemberName: null,
            assignedAt: null,
            startedAt: null,
            scheduledAt: null,
            resolvedAt: null,
            notes: null,
            createdAt: '2026-08-26T04:00:00.000Z',
            updatedAt: '2026-08-26T04:00:00.000Z',
            visitLocation: null,
          },
          {
            id: 'wo-resolved',
            title: 'Estación sin conexión: Calima – Digital Twin 01',
            status: 'RESOLVED',
            priority: 'HIGH',
            source: 'CONNECTIVITY_LOSS',
            stationId: 'cs-1',
            stationName: 'Calima – Digital Twin 01',
            assignedMemberId: null,
            assignedMemberName: null,
            assignedAt: null,
            startedAt: null,
            scheduledAt: null,
            resolvedAt: '2026-08-25T10:00:00.000Z',
            notes: 'Conectividad restablecida automáticamente.',
            createdAt: '2026-08-25T09:00:00.000Z',
            updatedAt: '2026-08-25T10:00:00.000Z',
            visitLocation: null,
          },
        ] as unknown as Awaited<ReturnType<typeof apiClient.get>>;
      }
      throw new ApiError(404, 'n/a');
    });

    render(<ChargingStationDetailPage />);

    const openRow = (
      await screen.findAllByText(
        'Estación sin conexión: Calima – Digital Twin 01',
      )
    )[0].closest('a')!;
    expect(within(openRow).getByText('Abierta')).toBeInTheDocument();

    const rows = screen.getAllByText(
      'Estación sin conexión: Calima – Digital Twin 01',
    );
    const resolvedRow = rows[1].closest('a')!;
    expect(within(resolvedRow).getByText('Resuelta')).toBeInTheDocument();
    // Distinct, real timestamps — not the same static label on every row.
    expect(within(openRow).getByText(/^Creada /)).toBeInTheDocument();
    expect(within(resolvedRow).getByText(/^Resuelta /)).toBeInTheDocument();
  });
});

// WO-ARGOS-091 §13.24 — the backend has no @Roles() restriction on
// GET /charging-stations/:id/ocpp-events (matches the existing precedent
// of GET /charging-stations/:id itself and GET /authorization-attempts);
// the frontend must not invent a stricter client-side gate that doesn't
// reflect the real backend policy. Confirmed across a real, non-privileged
// role — not just OWNER, which every other RBAC test here already covers.
describe('ChargingStationDetailPage — OCPP Activity RBAC visibility', () => {
  it('a VIEWER (the least-privileged real role with station access) still sees Actividad OCPP', async () => {
    mockAuth('VIEWER');
    vi.spyOn(chargingApi, 'getChargingStation').mockResolvedValue(station());
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/ocpp-events')) {
        return {
          events: [
            {
              id: 'evt-1',
              chargingStationId: 'cs-1',
              protocolVersion: 'OCPP1_6J',
              direction: 'INBOUND',
              messageType: 'CALL',
              action: 'Heartbeat',
              protocolMessageId: 'msg-1',
              payload: {},
              processingStatus: 'PROCESSED',
              processingError: null,
              receivedAt: '2026-08-26T17:00:00.000Z',
            },
          ],
          hasMore: false,
        };
      }
      throw new ApiError(404, 'n/a');
    });

    render(<ChargingStationDetailPage />);

    expect(await screen.findByText('Actividad OCPP')).toBeInTheDocument();
    expect(await screen.findByText('Heartbeat')).toBeInTheDocument();
  });
});
