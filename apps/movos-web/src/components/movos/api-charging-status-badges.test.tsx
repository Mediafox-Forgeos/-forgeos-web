import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
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
