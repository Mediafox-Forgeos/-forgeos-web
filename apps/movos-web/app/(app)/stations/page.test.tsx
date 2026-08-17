import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiChargingStationListItem } from '@mediafox/shared-types';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import * as usePolledResourceModule from '@/components/operator/use-polled-resource';
import { apiClient } from '@/lib/api-client';
import StationsPage from './page';

afterEach(() => {
  vi.restoreAllMocks();
});

function station(
  overrides: Partial<ApiChargingStationListItem> = {},
): ApiChargingStationListItem {
  return {
    id: 'station-1',
    siteId: 'site-1',
    siteName: 'Centro Comercial Calima',
    name: 'Estación 01',
    code: 'CHG-01',
    manufacturer: null,
    model: null,
    serialNumber: null,
    protocol: 'OCPP1_6J',
    status: 'ACTIVE',
    commissionedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    connectivityStatus: 'ONLINE',
    lastConnectedAt: '2026-08-17T00:00:00.000Z',
    lastDisconnectedAt: null,
    lastSeenAt: '2026-08-17T00:00:00.000Z',
    lastProtocolVersion: 'OCPP1_6J',
    ...overrides,
  };
}

// WO-ARGOS-054 — /stations is now a real global ChargingStation inventory,
// not a redirect('/sites'). This replaces the previous redirect-only test.
describe('/stations', () => {
  it('renders real ChargingStation records with a drill-down link, no redirect', async () => {
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [station()],
      loading: false,
      error: false,
      refetch: () => {},
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);

    render(<StationsPage />);

    const link = await screen.findByRole('link', { name: 'Estación 01' });
    expect(link).toHaveAttribute(
      'href',
      '/sites/site-1/charging-stations/station-1',
    );
    expect(screen.getByText('Centro Comercial Calima')).toBeInTheDocument();
    expect(screen.getByText('CHG-01')).toBeInTheDocument();
  });

  it('shows an empty state instead of any mock/demo station when there are none', async () => {
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [],
      loading: false,
      error: false,
      refetch: () => {},
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);

    render(<StationsPage />);

    expect(
      await screen.findByText(
        'No hay estaciones que coincidan con estos filtros.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('CHG-01')).not.toBeInTheDocument();
  });
});
