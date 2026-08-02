import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiChargingStation } from '@mediafox/shared-types';

import { ChargingStationList } from './charging-station-list';
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

function station(
  overrides: Partial<ApiChargingStation> = {},
): ApiChargingStation {
  return {
    id: 'cs1',
    siteId: 'site1',
    name: 'Estación Bogotá Centro 01',
    code: 'BOG-CTR-01',
    manufacturer: 'Kempower',
    model: 'Satellite 400',
    serialNumber: null,
    protocol: null,
    status: 'ACTIVE',
    commissionedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    connectivityStatus: 'UNKNOWN',
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastSeenAt: null,
    lastProtocolVersion: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChargingStationList', () => {
  it('shows a loading state before data resolves', () => {
    vi.spyOn(chargingApi, 'listChargingStationsBySite').mockReturnValue(
      new Promise(() => {}),
    );
    const { container } = render(
      <ChargingStationList siteId="site1" canManage={false} />,
    );
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders stations once loaded', async () => {
    vi.spyOn(chargingApi, 'listChargingStationsBySite').mockResolvedValue([
      station(),
    ]);
    render(<ChargingStationList siteId="site1" canManage={false} />);

    expect(
      await screen.findByText('Estación Bogotá Centro 01'),
    ).toBeInTheDocument();
    expect(screen.getByText(/BOG-CTR-01/)).toBeInTheDocument();
  });

  it('shows an empty state with no stations', async () => {
    vi.spyOn(chargingApi, 'listChargingStationsBySite').mockResolvedValue([]);
    render(<ChargingStationList siteId="site1" canManage={false} />);

    expect(
      await screen.findByText(
        'No hay estaciones de carga registradas en este sitio.',
      ),
    ).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    vi.spyOn(chargingApi, 'listChargingStationsBySite').mockRejectedValue(
      new ApiError(500, 'boom'),
    );
    render(<ChargingStationList siteId="site1" canManage={false} />);

    expect(
      await screen.findByText('No fue posible cargar las estaciones de carga.'),
    ).toBeInTheDocument();
  });

  it('only shows the create action when canManage is true', async () => {
    vi.spyOn(chargingApi, 'listChargingStationsBySite').mockResolvedValue([]);
    render(<ChargingStationList siteId="site1" canManage={false} />);

    await screen.findByText(
      'No hay estaciones de carga registradas en este sitio.',
    );
    expect(
      screen.queryByRole('button', { name: /crear estación/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the create modal when the action is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(chargingApi, 'listChargingStationsBySite').mockResolvedValue([]);
    render(<ChargingStationList siteId="site1" canManage />);

    const button = await screen.findByRole('button', {
      name: /crear estación/i,
    });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
