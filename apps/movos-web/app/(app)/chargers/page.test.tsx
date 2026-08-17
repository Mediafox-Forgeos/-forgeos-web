import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiEvseListItem } from '@mediafox/shared-types';

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
import ChargersPage from './page';

afterEach(() => {
  vi.restoreAllMocks();
});

function evse(overrides: Partial<ApiEvseListItem> = {}): ApiEvseListItem {
  return {
    id: 'evse-1',
    chargingStationId: 'station-1',
    chargingStationName: 'Estación 01',
    siteId: 'site-1',
    siteName: 'Centro Comercial Calima',
    externalId: '1',
    name: 'Cargador DC 60kW',
    status: 'AVAILABLE',
    maxPowerKw: 60,
    currentType: 'DC',
    phaseType: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

// WO-ARGOS-054 — /chargers is now a real global EVSE inventory ("Cargador"
// is the friendly UX name for Evse), not the generic SiteSelectionList
// gateway. Replaces the previous "pick a site first" test.
describe('/chargers', () => {
  it('renders real EVSE records with a drill-down link, not the site-picker gateway', async () => {
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [evse()],
      loading: false,
      error: false,
      refetch: () => {},
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);

    render(<ChargersPage />);

    const link = await screen.findByRole('link', {
      name: 'Cargador DC 60kW',
    });
    expect(link).toHaveAttribute(
      'href',
      '/sites/site-1/charging-stations/station-1/evses/evse-1',
    );
    expect(screen.getByText('Estación 01')).toBeInTheDocument();
    expect(screen.getByText('60 kW')).toBeInTheDocument();
    // The old gateway copy must never appear here anymore.
    expect(
      screen.queryByText(/Las estaciones de carga pertenecen a un Sitio/),
    ).not.toBeInTheDocument();
    // Mock fixture identifiers from the old demo data must never appear.
    expect(screen.queryByText('Kempower')).not.toBeInTheDocument();
  });
});
