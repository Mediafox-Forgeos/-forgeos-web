import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkHealthWidget } from './network-health-widget';
import { apiClient } from '@/lib/api-client';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function mockGet(responses: {
  sites?: unknown[] | (() => Promise<unknown>);
  connectivity?: unknown | (() => Promise<unknown>);
  occupancy?: unknown | (() => Promise<unknown>);
}) {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === '/sites') {
      return typeof responses.sites === 'function'
        ? responses.sites()
        : Promise.resolve(responses.sites ?? []);
    }
    if (path === '/operator/connectivity') {
      return typeof responses.connectivity === 'function'
        ? responses.connectivity()
        : Promise.resolve(responses.connectivity);
    }
    if (path === '/operator/occupancy') {
      return typeof responses.occupancy === 'function'
        ? responses.occupancy()
        : Promise.resolve(responses.occupancy);
    }
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NetworkHealthWidget — real, reused aggregation (WO-ARGOS-057)', () => {
  it('renders real counts from the existing /sites, /operator/connectivity, /operator/occupancy endpoints', async () => {
    mockGet({
      sites: [{ id: 's1' }, { id: 's2' }],
      connectivity: {
        organizationId: 'org-1',
        siteId: null,
        totalStations: 6,
        online: 4,
        offline: 1,
        unknown: 1,
      },
      occupancy: {
        organizationId: 'org-1',
        siteId: null,
        totalConnectors: 10,
        connectorStatusCounts: {
          AVAILABLE: 5,
          CHARGING: 2,
          OCCUPIED: 1,
          RESERVED: 0,
          UNAVAILABLE: 1,
          FAULTED: 1,
          OFFLINE: 0,
        },
        occupiedCount: 3,
        eligibleCount: 8,
        occupancyRate: 0.375,
      },
    });

    render(<NetworkHealthWidget />);

    expect(await screen.findByText('2')).toBeInTheDocument(); // sites
    expect(screen.getByText('6')).toBeInTheDocument(); // stations
    expect(screen.getByText('10')).toBeInTheDocument(); // connectors
    expect(screen.getByText(/4 en línea/)).toBeInTheDocument();
    expect(screen.getByText(/1 desconectadas/)).toBeInTheDocument();
    expect(screen.getByText(/5 disponibles/)).toBeInTheDocument();
    expect(screen.getByText(/3 en uso/)).toBeInTheDocument();
    expect(screen.getByText(/1 con falla/)).toBeInTheDocument();
  });

  it('links each metric to its real inventory page, not a fabricated filtered URL', async () => {
    mockGet({
      sites: [],
      connectivity: {
        organizationId: 'org-1',
        siteId: null,
        totalStations: 0,
        online: 0,
        offline: 0,
        unknown: 0,
      },
      occupancy: {
        organizationId: 'org-1',
        siteId: null,
        totalConnectors: 0,
        connectorStatusCounts: {
          AVAILABLE: 0,
          CHARGING: 0,
          OCCUPIED: 0,
          RESERVED: 0,
          UNAVAILABLE: 0,
          FAULTED: 0,
          OFFLINE: 0,
        },
        occupiedCount: 0,
        eligibleCount: 0,
        occupancyRate: null,
      },
    });

    render(<NetworkHealthWidget />);

    await screen.findByText('sitios');
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/sites', '/stations', '/connectors']),
    );
  });

  it('shows the full-failure message only when every source fails', async () => {
    mockGet({
      sites: () => Promise.reject(new Error('boom')),
      connectivity: () => Promise.reject(new Error('boom')),
      occupancy: () => Promise.reject(new Error('boom')),
    });

    render(<NetworkHealthWidget />);

    expect(
      await screen.findByText('No se pudo cargar el estado de la red.'),
    ).toBeInTheDocument();
  });

  it('renders successfully-loaded metrics even when one source fails (partial data, honestly labeled)', async () => {
    mockGet({
      sites: [{ id: 's1' }],
      connectivity: () => Promise.reject(new Error('boom')),
      occupancy: {
        organizationId: 'org-1',
        siteId: null,
        totalConnectors: 3,
        connectorStatusCounts: {
          AVAILABLE: 3,
          CHARGING: 0,
          OCCUPIED: 0,
          RESERVED: 0,
          UNAVAILABLE: 0,
          FAULTED: 0,
          OFFLINE: 0,
        },
        occupiedCount: 0,
        eligibleCount: 3,
        occupancyRate: 0,
      },
    });

    render(<NetworkHealthWidget />);

    expect(await screen.findByText('3')).toBeInTheDocument(); // connectors, loaded fine
    expect(
      screen.getByText('No se pudo cargar la conectividad.'),
    ).toBeInTheDocument();
  });
});
