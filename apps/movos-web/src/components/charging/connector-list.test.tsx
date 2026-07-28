import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiConnector } from '@mediafox/shared-types';

import { ConnectorList } from './connector-list';
import { ApiError } from '@/lib/api-client';
import * as chargingApi from '@/lib/charging-api';

function connector(overrides: Partial<ApiConnector> = {}): ApiConnector {
  return {
    id: 'c1',
    evseId: 'e1',
    externalId: '1',
    type: 'CCS2',
    status: 'AVAILABLE',
    maxPowerKw: 180,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConnectorList', () => {
  it('derives the connector count from the returned collection', async () => {
    vi.spyOn(chargingApi, 'listConnectorsByEvse').mockResolvedValue([
      connector({ id: 'c1' }),
      connector({ id: 'c2' }),
      connector({ id: 'c3' }),
    ]);
    render(<ConnectorList evseId="e1" canManage={false} />);

    const summary = await screen.findByTestId('connector-summary');
    expect(summary).toHaveTextContent('3 conectores');
  });

  it('shows an empty state with no connectors', async () => {
    vi.spyOn(chargingApi, 'listConnectorsByEvse').mockResolvedValue([]);
    render(<ConnectorList evseId="e1" canManage={false} />);

    expect(
      await screen.findByText('No hay conectores registrados en este EVSE.'),
    ).toBeInTheDocument();
  });

  it('shows a not-found state when the parent EVSE is inaccessible', async () => {
    vi.spyOn(chargingApi, 'listConnectorsByEvse').mockRejectedValue(
      new ApiError(404, 'not found'),
    );
    render(<ConnectorList evseId="e1" canManage={false} />);

    expect(
      await screen.findByText('Este EVSE no está disponible.'),
    ).toBeInTheDocument();
  });
});
