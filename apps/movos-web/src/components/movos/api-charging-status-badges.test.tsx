import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ApiChargingSessionStatusBadge,
  ApiChargingStationStatusBadge,
  ApiConnectivityStatusBadge,
} from './api-charging-status-badges';

// CAP-005 (WO-ARGOS-010) scenario 14: the connectivity badge renders each
// of the three ConnectivityStatus values with a distinct, correct label.
describe('ApiConnectivityStatusBadge', () => {
  it.each([
    ['ONLINE', 'En línea'],
    ['OFFLINE', 'Desconectado'],
    ['UNKNOWN', 'Desconocido'],
  ])('renders %s as %s', (status, label) => {
    render(<ApiConnectivityStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to the raw status for an unrecognized value', () => {
    render(<ApiConnectivityStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});

// Scenario 15: device connectivity (ConnectivityStatus) and station
// administrative status (ChargingStationStatus) are rendered as two
// separate, independently-labeled badges — never conflated into one.
describe('connectivity vs. administrative status badges', () => {
  it('render distinct labels side by side for an ACTIVE station that is OFFLINE', () => {
    render(
      <>
        <ApiChargingStationStatusBadge status="ACTIVE" />
        <ApiConnectivityStatusBadge status="OFFLINE" />
      </>,
    );

    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Desconectado')).toBeInTheDocument();
  });
});

// WO-ARGOS-023 — every real ChargingSessionStatus value renders a distinct
// label, covering all 10 values the real API can return (not the 5-value
// fictional enum the legacy mock SessionStatusBadge maps).
describe('ApiChargingSessionStatusBadge', () => {
  it.each([
    ['PENDING', 'Pendiente'],
    ['AUTHORIZED', 'Autorizada'],
    ['STARTING', 'Iniciando'],
    ['ACTIVE', 'Activa'],
    ['SUSPENDED', 'Suspendida'],
    ['OFFLINE', 'Sin conexión'],
    ['STOPPING', 'Deteniendo'],
    ['COMPLETED', 'Completada'],
    ['FAILED', 'Fallida'],
    ['CANCELLED', 'Cancelada'],
  ])('renders %s as %s', (status, label) => {
    render(<ApiChargingSessionStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to the raw status for an unrecognized value', () => {
    render(<ApiChargingSessionStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});
