import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UnifiedAttentionWidget } from './unified-attention-widget';
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

const EVSE_PATH = '/evses';
const WORK_ORDERS_PATH = '/work-orders/attention';
const OFFLINE_PATH = '/operator/offline-stations';

function mockGet(responses: {
  evses?: unknown[] | (() => Promise<unknown>);
  workOrders?: unknown[] | (() => Promise<unknown>);
  offline?: unknown[] | (() => Promise<unknown>);
}) {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === EVSE_PATH) {
      return typeof responses.evses === 'function'
        ? responses.evses()
        : Promise.resolve(responses.evses ?? []);
    }
    if (path === WORK_ORDERS_PATH) {
      return typeof responses.workOrders === 'function'
        ? responses.workOrders()
        : Promise.resolve(responses.workOrders ?? []);
    }
    if (path === OFFLINE_PATH) {
      return typeof responses.offline === 'function'
        ? responses.offline()
        : Promise.resolve(responses.offline ?? []);
    }
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UnifiedAttentionWidget — partial source failure (WO-ARGOS-057)', () => {
  it('shows an explicit incomplete-data warning when one source fails while others succeed, never a silent partial count', async () => {
    mockGet({
      evses: [],
      workOrders: () => Promise.reject(new Error('boom')),
      offline: [
        {
          stationId: 's1',
          stationName: 'Estación 1',
          siteId: 'site1',
          siteName: 'Sitio 1',
          lastDisconnectedAt: '2026-08-17T00:00:00.000Z',
        },
      ],
    });

    render(<UnifiedAttentionWidget />);

    const warning = await screen.findByText(
      /Esta lista puede estar incompleta/,
    );
    expect(warning).toHaveTextContent('órdenes de trabajo');
    // The successfully-loaded offline station must still render — a
    // partial failure must not blank out the sources that did succeed.
    expect(await screen.findByText('Estación 1')).toBeInTheDocument();
  });

  it('shows the full-failure message only when every source fails', async () => {
    mockGet({
      evses: () => Promise.reject(new Error('boom')),
      workOrders: () => Promise.reject(new Error('boom')),
      offline: () => Promise.reject(new Error('boom')),
    });

    render(<UnifiedAttentionWidget />);

    expect(
      await screen.findByText('No se pudo cargar el resumen de atención.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Esta lista puede estar incompleta/),
    ).not.toBeInTheDocument();
  });

  it('never claims "nothing requires attention" when data is incomplete', async () => {
    mockGet({
      evses: () => Promise.reject(new Error('boom')),
      workOrders: [],
      offline: [],
    });

    render(<UnifiedAttentionWidget />);

    await screen.findByText(/Esta lista puede estar incompleta/);
    expect(
      screen.queryByText('Nada requiere atención en este momento.'),
    ).not.toBeInTheDocument();
  });
});

describe('UnifiedAttentionWidget — unified, deduplicated rendering', () => {
  it('merges an offline station and its WorkOrder into one card, count 1 not 2', async () => {
    mockGet({
      evses: [],
      workOrders: [
        {
          workOrder: {
            id: 'wo-1',
            title: 'Revisar Calima',
            description: '',
            status: 'OPEN',
            priority: 'HIGH',
            source: 'CONNECTIVITY_LOSS',
            stationId: 's1',
            stationName: 'Estación 1',
            assignedMemberId: null,
            assignedMemberName: null,
            assignedAt: null,
            startedAt: null,
            scheduledAt: null,
            resolvedAt: null,
            notes: null,
            createdAt: '2026-08-17T00:00:00.000Z',
            updatedAt: '2026-08-17T00:00:00.000Z',
            visitLocation: {
              siteName: 'Sitio 1',
              stationName: 'Estación 1',
              formattedAddress: null,
              latitude: null,
              longitude: null,
            },
          },
          reasons: ['UNASSIGNED'],
        },
      ],
      offline: [
        {
          stationId: 's1',
          stationName: 'Estación 1',
          siteId: 'site1',
          siteName: 'Sitio 1',
          lastDisconnectedAt: '2026-08-17T00:00:00.000Z',
        },
      ],
    });

    render(<UnifiedAttentionWidget />);

    expect(
      await screen.findByText('Requiere atención (1)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Estación 1')).toBeInTheDocument();
    expect(screen.getByText(/Revisar Calima/)).toBeInTheDocument();
  });

  it('shows the all-clear message only when every source succeeds with zero items', async () => {
    mockGet({ evses: [], workOrders: [], offline: [] });

    render(<UnifiedAttentionWidget />);

    expect(
      await screen.findByText('Nada requiere atención en este momento.'),
    ).toBeInTheDocument();
  });
});
