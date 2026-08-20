import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiRemoteCommand } from '@mediafox/shared-types';

import { RemoteCommandModal } from './remote-command-modal';
import * as remoteCommandsApi from '@/lib/remote-commands-api';

function command(overrides: Partial<ApiRemoteCommand> = {}): ApiRemoteCommand {
  return {
    id: 'cmd-1',
    organizationId: 'org-1',
    chargingStationId: 'cs-1',
    connectorId: 'connector-1',
    chargingSessionId: null,
    commandType: 'REMOTE_START',
    state: 'ACCEPTED',
    requestedByUserId: 'user-1',
    rejectionReason: null,
    requestedAt: '2026-08-19T00:00:00.000Z',
    sentAt: '2026-08-19T00:00:00.100Z',
    acceptedAt: '2026-08-19T00:00:00.200Z',
    resolvedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  commandType: 'REMOTE_START' as const,
  title: 'Iniciar carga remota',
  contextLines: [{ label: 'Conector', value: 'CCS2 · 1' }],
  confirmQuestion: '¿Iniciar carga remota en este conector?',
  warningText: 'Advertencia.',
};

describe('RemoteCommandModal (WO-ARGOS-064 §20/§26 honest command-result UX)', () => {
  it('never claims success before ACCEPTED — shows "Solicitud aceptada..." not "Carga iniciada" right after confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(command({ state: 'ACCEPTED' }));
    const user = userEvent.setup();
    render(<RemoteCommandModal {...baseProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText(
        'Solicitud aceptada por el cargador. Esperando inicio de carga.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Carga iniciada.')).not.toBeInTheDocument();
  });

  it('shows "Carga iniciada." only once the polled command reaches CONFIRMED', async () => {
    const onConfirm = vi.fn().mockResolvedValue(command({ state: 'ACCEPTED' }));
    vi.spyOn(remoteCommandsApi, 'getRemoteCommand').mockResolvedValue(
      command({ state: 'CONFIRMED' }),
    );
    const user = userEvent.setup();
    render(<RemoteCommandModal {...baseProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText(
      'Solicitud aceptada por el cargador. Esperando inicio de carga.',
    );

    await waitFor(
      () => {
        expect(screen.getByText('Carga iniciada.')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('shows the honest UNCONFIRMED message, distinct from REJECTED/TIMED_OUT, when polling settles there', async () => {
    const onConfirm = vi.fn().mockResolvedValue(command({ state: 'ACCEPTED' }));
    vi.spyOn(remoteCommandsApi, 'getRemoteCommand').mockResolvedValue(
      command({ state: 'UNCONFIRMED' }),
    );
    const user = userEvent.setup();
    render(<RemoteCommandModal {...baseProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(
      () => {
        expect(
          screen.getByText(
            'El cargador aceptó la solicitud, pero MOVOS no confirmó el inicio de la carga.',
          ),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('shows REJECTED immediately with no polling when the command resolves rejected synchronously', async () => {
    const onConfirm = vi.fn().mockResolvedValue(command({ state: 'REJECTED' }));
    const getRemoteCommand = vi.spyOn(remoteCommandsApi, 'getRemoteCommand');
    const user = userEvent.setup();
    render(<RemoteCommandModal {...baseProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText('El cargador rechazó la solicitud.'),
    ).toBeInTheDocument();
    expect(getRemoteCommand).not.toHaveBeenCalled();
  });

  it('shows an error and offers retry when the request itself fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<RemoteCommandModal {...baseProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText(
        'No fue posible enviar la solicitud. Intenta nuevamente.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });

  it('disables Confirmar and shows the reason when confirmDisabled is set', () => {
    render(
      <RemoteCommandModal
        {...baseProps}
        onConfirm={vi.fn()}
        confirmDisabled={true}
        confirmDisabledReason="No hay credenciales de autorización activas en esta organización."
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(
      screen.getByText(
        'No hay credenciales de autorización activas en esta organización.',
      ),
    ).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <RemoteCommandModal {...baseProps} open={false} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
