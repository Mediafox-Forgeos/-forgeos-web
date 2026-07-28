import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiChargingStation } from '@mediafox/shared-types';

import { ChargingStationFormModal } from './charging-station-form-modal';
import * as chargingApi from '@/lib/charging-api';

afterEach(() => {
  vi.restoreAllMocks();
});

function station(): ApiChargingStation {
  return {
    id: 'cs1',
    siteId: 'site1',
    name: 'Estación existente',
    code: 'BOG-CTR-01',
    manufacturer: 'Kempower',
    model: 'Satellite 400',
    serialNumber: null,
    protocol: null,
    status: 'ACTIVE',
    commissionedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ChargingStationFormModal', () => {
  it('rejects submission with an empty name (create mode)', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(chargingApi, 'createChargingStation');

    render(
      <ChargingStationFormModal
        open
        onClose={() => {}}
        siteId="site1"
        onSaved={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /crear estación/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El nombre es requerido.',
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('submits a valid create form and calls onSaved', async () => {
    const user = userEvent.setup();
    const created = station();
    vi.spyOn(chargingApi, 'createChargingStation').mockResolvedValue(created);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <ChargingStationFormModal
        open
        onClose={onClose}
        siteId="site1"
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByLabelText('Nombre'), 'Estación existente');
    await user.click(screen.getByRole('button', { name: /crear estación/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(created);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('pre-fills fields and submits an update in edit mode', async () => {
    const user = userEvent.setup();
    const existing = station();
    const updated = { ...existing, name: 'Estación renombrada' };
    const updateSpy = vi
      .spyOn(chargingApi, 'updateChargingStation')
      .mockResolvedValue(updated);
    const onSaved = vi.fn();

    render(
      <ChargingStationFormModal
        open
        onClose={() => {}}
        station={existing}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByLabelText('Nombre')).toHaveValue('Estación existente');

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Estación renombrada');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'cs1',
        expect.objectContaining({ name: 'Estación renombrada' }),
      );
      expect(onSaved).toHaveBeenCalledWith(updated);
    });
  });
});
