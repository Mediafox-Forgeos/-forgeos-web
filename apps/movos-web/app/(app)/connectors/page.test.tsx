import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiConnectorListItem } from '@mediafox/shared-types';

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
import ConnectorsPage from './page';

afterEach(() => {
  vi.restoreAllMocks();
});

function connector(
  overrides: Partial<ApiConnectorListItem> = {},
): ApiConnectorListItem {
  return {
    id: 'connector-1',
    evseId: 'evse-1',
    evseName: 'Cargador DC 60kW',
    chargingStationId: 'station-1',
    chargingStationName: 'Estación 01',
    siteId: 'site-1',
    siteName: 'Centro Comercial Calima',
    externalId: '1',
    type: 'CCS2',
    status: 'AVAILABLE',
    maxPowerKw: 30,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

// WO-ARGOS-054 — /connectors is now a real global Connector inventory, not
// the generic SiteSelectionList gateway. No dedicated Connector detail page
// exists, so each row drills into its parent EVSE's real detail page.
describe('/connectors', () => {
  it('renders real Connector records with a drill-down link into the parent EVSE detail', async () => {
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [connector()],
      loading: false,
      error: false,
      refetch: () => {},
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);

    render(<ConnectorsPage />);

    const link = await screen.findByRole('link', { name: '1' });
    expect(link).toHaveAttribute(
      'href',
      '/sites/site-1/charging-stations/station-1/evses/evse-1',
    );
    expect(screen.getByText('CCS2')).toBeInTheDocument();
    expect(screen.getByText('Cargador DC 60kW')).toBeInTheDocument();
    expect(screen.getByText('Estación 01')).toBeInTheDocument();
    // The old gateway copy must never appear here anymore.
    expect(
      screen.queryByText(/Los conectores pertenecen a un EVSE/),
    ).not.toBeInTheDocument();
  });
});
