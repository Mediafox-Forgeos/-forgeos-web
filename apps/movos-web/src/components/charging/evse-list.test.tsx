import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiEvse } from '@mediafox/shared-types';

import { EvseList } from './evse-list';
import { ApiError } from '@/lib/api-client';
import * as chargingApi from '@/lib/charging-api';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function evse(overrides: Partial<ApiEvse> = {}): ApiEvse {
  return {
    id: 'e1',
    chargingStationId: 'cs1',
    externalId: '1',
    name: null,
    status: 'AVAILABLE',
    maxPowerKw: 180,
    currentType: 'DC',
    phaseType: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EvseList — derived metrics', () => {
  it('derives the EVSE count and availability percentage from real statuses', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockResolvedValue([
      evse({ id: 'e1', status: 'AVAILABLE' }),
      evse({ id: 'e2', status: 'AVAILABLE' }),
      evse({ id: 'e3', status: 'OFFLINE' }),
      evse({ id: 'e4', status: 'FAULTED' }),
    ]);
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    const summary = await screen.findByTestId('evse-summary');
    // 4 EVSEs total, 2 of 4 AVAILABLE -> 50%. Computed live in the
    // component from the statuses the mocked API just returned, not
    // fabricated or copied from any mock/demo fixture.
    expect(summary).toHaveTextContent('4 EVSEs');
    expect(summary).toHaveTextContent('50% disponible');
  });

  it('never fabricates an availability percentage when there are no EVSEs', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockResolvedValue([]);
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    await screen.findByText('No hay EVSEs registrados en esta estación.');
    // The summary line itself still renders (0 EVSEs), but it must never
    // show a computed 0%/100% placeholder for an empty collection — only
    // an explicit "not available" label.
    const summary = screen.getByTestId('evse-summary');
    expect(summary).toHaveTextContent('Disponibilidad no disponible aún');
    expect(screen.queryByText(/% disponible/)).not.toBeInTheDocument();
  });
});

describe('EvseList — tenant-access failure', () => {
  it('shows a not-found state (not a data leak) when the parent station is inaccessible', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockRejectedValue(
      new ApiError(404, 'not found'),
    );
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    expect(
      await screen.findByText('Esta estación de carga no está disponible.'),
    ).toBeInTheDocument();
  });

  it('distinguishes a generic error from a tenant/not-found failure', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockRejectedValue(
      new ApiError(500, 'boom'),
    );
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    expect(
      await screen.findByText('No fue posible cargar los EVSEs.'),
    ).toBeInTheDocument();
  });
});
