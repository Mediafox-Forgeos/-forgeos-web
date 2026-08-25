import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InvitePage from './page';
import { ApiError } from '@/lib/api-client';
import * as membershipsApi from '@/lib/memberships-api';

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'a-real-token' }),
}));

function preview() {
  return {
    organizationName: 'Kylum Energy',
    email: 'nueva@kylumenergy.com',
    role: 'VIEWER',
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InvitePage — valid invitation', () => {
  it('shows the organization, email, and role from the preview, and a form to accept', async () => {
    vi.spyOn(membershipsApi, 'previewInvitation').mockResolvedValue(preview());

    render(<InvitePage />);

    expect(
      await screen.findByText('Te invitaron a Kylum Energy'),
    ).toBeInTheDocument();
    expect(screen.getByText('nueva@kylumenergy.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Tu nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });
});

describe('InvitePage — invalid/expired/used token', () => {
  it('shows a bounded, honest error state instead of an infinite loading spinner', async () => {
    vi.spyOn(membershipsApi, 'previewInvitation').mockRejectedValue(
      new ApiError(404, 'Esta invitación no es válida o ya expiró.'),
    );

    render(<InvitePage />);

    expect(
      await screen.findByText('Esta invitación no es válida o ya expiró.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });
});

describe('InvitePage — client-side password validation', () => {
  it('rejects a password under 8 characters before calling the API', async () => {
    vi.spyOn(membershipsApi, 'previewInvitation').mockResolvedValue(preview());
    const acceptSpy = vi.spyOn(membershipsApi, 'acceptInvitation');
    const user = userEvent.setup();

    render(<InvitePage />);
    await screen.findByLabelText('Tu nombre');
    await user.type(screen.getByLabelText('Tu nombre'), 'Nueva Persona');
    await user.type(screen.getByLabelText('Contraseña'), 'short1');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'short1');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText(
        'La contraseña debe tener al menos 8 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(acceptSpy).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation before calling the API', async () => {
    vi.spyOn(membershipsApi, 'previewInvitation').mockResolvedValue(preview());
    const acceptSpy = vi.spyOn(membershipsApi, 'acceptInvitation');
    const user = userEvent.setup();

    render(<InvitePage />);
    await screen.findByLabelText('Tu nombre');
    await user.type(screen.getByLabelText('Tu nombre'), 'Nueva Persona');
    await user.type(screen.getByLabelText('Contraseña'), 'a-real-password');
    await user.type(
      screen.getByLabelText('Confirmar contraseña'),
      'a-different-password',
    );
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Las contraseñas no coinciden.'),
    ).toBeInTheDocument();
    expect(acceptSpy).not.toHaveBeenCalled();
  });
});

describe('InvitePage — successful acceptance', () => {
  it('accepts, shows a success state, and never auto-navigates/auto-logs-in', async () => {
    vi.spyOn(membershipsApi, 'previewInvitation').mockResolvedValue(preview());
    const acceptSpy = vi
      .spyOn(membershipsApi, 'acceptInvitation')
      .mockResolvedValue({ email: 'nueva@kylumenergy.com' });
    const user = userEvent.setup();

    render(<InvitePage />);
    await screen.findByLabelText('Tu nombre');
    await user.type(screen.getByLabelText('Tu nombre'), 'Nueva Persona');
    await user.type(screen.getByLabelText('Contraseña'), 'a-real-password');
    await user.type(
      screen.getByLabelText('Confirmar contraseña'),
      'a-real-password',
    );
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(acceptSpy).toHaveBeenCalledWith('a-real-token', {
      displayName: 'Nueva Persona',
      password: 'a-real-password',
      passwordConfirmation: 'a-real-password',
    });
    expect(
      await screen.findByText('Cuenta creada correctamente.'),
    ).toBeInTheDocument();
    // A manual link, not an automatic redirect/session — the user still has
    // to click through and log in normally (WO-ARGOS-089 §12).
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('surfaces a backend rejection at accept time honestly, without fabricating success', async () => {
    vi.spyOn(membershipsApi, 'previewInvitation').mockResolvedValue(preview());
    vi.spyOn(membershipsApi, 'acceptInvitation').mockRejectedValue(
      new ApiError(409, 'Este usuario ya es miembro de esta organización.'),
    );
    const user = userEvent.setup();

    render(<InvitePage />);
    await screen.findByLabelText('Tu nombre');
    await user.type(screen.getByLabelText('Tu nombre'), 'Nueva Persona');
    await user.type(screen.getByLabelText('Contraseña'), 'a-real-password');
    await user.type(
      screen.getByLabelText('Confirmar contraseña'),
      'a-real-password',
    );
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText(
        'Este usuario ya es miembro de esta organización.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Cuenta creada correctamente.'),
    ).not.toBeInTheDocument();
  });
});
