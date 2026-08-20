import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiConnector } from '@mediafox/shared-types';

import { ConnectorList } from './connector-list';
import { ApiError } from '@/lib/api-client';
import * as chargingApi from '@/lib/charging-api';
import * as remoteCommandsApi from '@/lib/remote-commands-api';

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

  // WO-ARGOS-064 — RemoteStart affordance on the connector/EVSE surface.
  describe('RemoteStart (WO-ARGOS-064)', () => {
    it('shows "Iniciar carga remota" for an AVAILABLE connector when canRemoteStart is true', async () => {
      vi.spyOn(chargingApi, 'listConnectorsByEvse').mockResolvedValue([
        connector({ status: 'AVAILABLE' }),
      ]);
      render(
        <ConnectorList evseId="e1" canManage={false} canRemoteStart={true} />,
      );

      expect(
        await screen.findByRole('button', { name: 'Iniciar carga remota' }),
      ).toBeInTheDocument();
    });

    it('does not show the button when canRemoteStart is false — backend RBAC is the real boundary, but the UI should not dangle it', async () => {
      vi.spyOn(chargingApi, 'listConnectorsByEvse').mockResolvedValue([
        connector({ status: 'AVAILABLE' }),
      ]);
      render(<ConnectorList evseId="e1" canManage={false} />);

      await screen.findByTestId('connector-summary');
      expect(
        screen.queryByRole('button', { name: 'Iniciar carga remota' }),
      ).not.toBeInTheDocument();
    });

    it('does not show the button for a connector that is not AVAILABLE', async () => {
      vi.spyOn(chargingApi, 'listConnectorsByEvse').mockResolvedValue([
        connector({ status: 'CHARGING' }),
      ]);
      render(
        <ConnectorList evseId="e1" canManage={false} canRemoteStart={true} />,
      );

      await screen.findByTestId('connector-summary');
      expect(
        screen.queryByRole('button', { name: 'Iniciar carga remota' }),
      ).not.toBeInTheDocument();
    });

    it('clicking the button opens the confirmation dialog showing Site/Station/EVSE/Connector context', async () => {
      vi.spyOn(chargingApi, 'listConnectorsByEvse').mockResolvedValue([
        connector({ status: 'AVAILABLE', externalId: '7' }),
      ]);
      vi.spyOn(remoteCommandsApi, 'listCredentials').mockResolvedValue([]);
      const user = userEvent.setup();

      render(
        <ConnectorList
          evseId="e1"
          canManage={false}
          canRemoteStart={true}
          siteName="Sitio Norte"
          stationName="Estación 1"
          evseName="EVSE A"
        />,
      );

      await user.click(
        await screen.findByRole('button', { name: 'Iniciar carga remota' }),
      );

      expect(
        screen.getByRole('dialog', { name: 'Iniciar carga remota' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Sitio Norte')).toBeInTheDocument();
      expect(screen.getByText('Estación 1')).toBeInTheDocument();
      expect(screen.getByText('EVSE A')).toBeInTheDocument();
      expect(
        screen.getByText('¿Iniciar carga remota en este conector?'),
      ).toBeInTheDocument();
    });
  });
});
