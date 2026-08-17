import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiEvseListItem } from '@mediafox/shared-types';

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

function evse(overrides: Partial<ApiEvseListItem> = {}): ApiEvseListItem {
  return {
    id: 'e1',
    chargingStationId: 'cs1',
    chargingStationName: 'Estación 01',
    siteId: 'site1',
    siteName: 'Sitio 1',
    externalId: '1',
    name: null,
    status: 'AVAILABLE',
    maxPowerKw: 180,
    currentType: 'DC',
    phaseType: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    operationalStatus: 'AVAILABLE',
    requiresAttention: false,
    attentionReasons: [],
    connectorSummary: {
      total: 1,
      available: 1,
      inUse: 0,
      unavailable: 0,
      faulted: 0,
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// WO-ARGOS-056 — the header summary is now connector-based ("X de Y
// conectores disponibles"), aggregated across every EVSE of the station,
// replacing the old Evse.status-based "% disponible" metric (which
// measured administrative status, unrelated to real charging activity).
describe('EvseList — connector-based availability (WO-ARGOS-056)', () => {
  it('aggregates real connectorSummary counts across every EVSE, not Evse.status', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockResolvedValue([
      evse({
        id: 'e1',
        connectorSummary: {
          total: 2,
          available: 1,
          inUse: 1,
          unavailable: 0,
          faulted: 0,
        },
      }),
      evse({
        id: 'e2',
        connectorSummary: {
          total: 1,
          available: 0,
          inUse: 0,
          unavailable: 1,
          faulted: 0,
        },
      }),
    ]);
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    const summary = await screen.findByTestId('evse-summary');
    // 2 EVSEs, 1 of the 3 total connectors across both is available.
    expect(summary).toHaveTextContent('2 EVSEs');
    expect(summary).toHaveTextContent('1 de 3 conectores disponibles');
    // The old percentage-of-EVSEs metric must never appear.
    expect(screen.queryByText(/% disponible/)).not.toBeInTheDocument();
  });

  it('never fabricates availability when there are no EVSEs', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockResolvedValue([]);
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    await screen.findByText('No hay EVSEs registrados en esta estación.');
    const summary = screen.getByTestId('evse-summary');
    expect(summary).toHaveTextContent('Sin conectores registrados');
    expect(screen.queryByText(/% disponible/)).not.toBeInTheDocument();
  });

  it('renders the derived Operational Status per EVSE, not the administrative Evse.status', async () => {
    vi.spyOn(chargingApi, 'listEvsesByChargingStation').mockResolvedValue([
      evse({ id: 'e1', status: 'UNAVAILABLE', operationalStatus: 'AVAILABLE' }),
    ]);
    render(
      <EvseList chargingStationId="cs1" siteId="site1" canManage={false} />,
    );

    // The card shows the derived status (AVAILABLE), even though the raw
    // administrative Evse.status is UNAVAILABLE — exactly the WO-ARGOS-056
    // scenario this work order exists to fix.
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
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
