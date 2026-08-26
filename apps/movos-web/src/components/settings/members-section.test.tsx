import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiOrganizationMember } from '@mediafox/shared-types';

import { MembersSection } from './members-section';
import { ApiError } from '@/lib/api-client';
import * as membershipsApi from '@/lib/memberships-api';
import * as authContext from '@/context/auth-context';

vi.mock('@/context/auth-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/context/auth-context')>();
  return { ...actual, useAuth: vi.fn() };
});

function mockAuth(role: string) {
  vi.mocked(authContext.useAuth).mockReturnValue({
    membership: { role },
  } as unknown as ReturnType<typeof authContext.useAuth>);
}

function member(
  overrides: Partial<ApiOrganizationMember> = {},
): ApiOrganizationMember {
  return {
    id: 'mem-1',
    userId: 'user-1',
    email: 'operador@kylumenergy.com',
    displayName: 'Operador Kylum',
    role: 'OPERATOR',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  // load() fetches members and pending invitations together — default to
  // no pending invitations so existing member-focused tests don't need to
  // know about this. Tests about invitations override this explicitly.
  vi.spyOn(membershipsApi, 'listPendingInvitations').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MembersSection — RBAC visibility', () => {
  it('OPERATOR cannot view or manage members', async () => {
    mockAuth('OPERATOR');
    const listSpy = vi.spyOn(membershipsApi, 'listMembers');

    render(<MembersSection />);

    expect(
      screen.getByText(/Solo OWNER o ADMIN pueden ver y administrar/),
    ).toBeInTheDocument();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('OWNER sees every row as editable, including OWNER/ADMIN rows', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([
      member({ id: 'mem-owner', role: 'OWNER', displayName: 'Dueña' }),
      member({ id: 'mem-1', role: 'OPERATOR' }),
    ]);

    render(<MembersSection />);

    const ownerRow = (await screen.findByText('Dueña')).closest('tr')!;
    expect(within(ownerRow).getByLabelText('Rol de Dueña')).toBeInTheDocument();
    expect(
      within(ownerRow).getByRole('button', { name: 'Desactivar' }),
    ).toBeInTheDocument();
  });

  it('ADMIN cannot edit an OWNER or ADMIN row, only lower roles', async () => {
    mockAuth('ADMIN');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([
      member({ id: 'mem-owner', role: 'OWNER', displayName: 'Dueña' }),
      member({ id: 'mem-op', role: 'OPERATOR', displayName: 'Operador Kylum' }),
    ]);

    render(<MembersSection />);

    const ownerRow = (await screen.findByText('Dueña')).closest('tr')!;
    expect(
      within(ownerRow).queryByLabelText('Rol de Dueña'),
    ).not.toBeInTheDocument();
    expect(
      within(ownerRow).queryByRole('button', { name: 'Desactivar' }),
    ).not.toBeInTheDocument();
    expect(within(ownerRow).getByText('Propietario')).toBeInTheDocument();

    const opRow = screen.getByText('Operador Kylum').closest('tr')!;
    expect(
      within(opRow).getByLabelText('Rol de Operador Kylum'),
    ).toBeInTheDocument();
  });
});

describe('MembersSection — real data, no fabrication', () => {
  it('renders real members and never the old fabricated counts', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([member()]);

    render(<MembersSection />);

    expect(
      await screen.findByText('operador@kylumenergy.com'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Operadores activos')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Invitaciones pendientes'),
    ).not.toBeInTheDocument();
  });

  it('shows an honest empty state when there are no other members', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([]);

    render(<MembersSection />);

    expect(
      await screen.findByText('No hay usuarios registrados todavía.'),
    ).toBeInTheDocument();
  });
});

describe('MembersSection — add user flow', () => {
  it('adding a user calls the API with email and role, and the new row appears', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([]);
    const addSpy = vi
      .spyOn(membershipsApi, 'addMember')
      .mockResolvedValue(
        member({ id: 'mem-new', displayName: 'Nueva Persona', role: 'VIEWER' }),
      );
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('No hay usuarios registrados todavía.');

    await user.click(screen.getByRole('button', { name: '+ Agregar usuario' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar usuario' });
    await user.type(
      within(dialog).getByLabelText('Correo electrónico'),
      'nueva@kylumenergy.com',
    );
    await user.selectOptions(within(dialog).getByLabelText('Rol'), 'VIEWER');
    await user.click(
      within(dialog).getByRole('button', { name: 'Agregar usuario' }),
    );

    await waitFor(() =>
      expect(addSpy).toHaveBeenCalledWith('nueva@kylumenergy.com', 'VIEWER'),
    );
    expect(await screen.findByText('Nueva Persona')).toBeInTheDocument();
  });

  it('surfaces the backend duplicate-membership message honestly, without closing the modal', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(membershipsApi, 'addMember').mockRejectedValue(
      new ApiError(409, 'Este usuario ya es miembro de esta organización.'),
    );
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('No hay usuarios registrados todavía.');
    await user.click(screen.getByRole('button', { name: '+ Agregar usuario' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar usuario' });
    await user.type(
      within(dialog).getByLabelText('Correo electrónico'),
      'ya-existe@kylumenergy.com',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Agregar usuario' }),
    );

    expect(
      await screen.findByText(
        'Este usuario ya es miembro de esta organización.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
  });

  it('a 409 (already member) does NOT fall back to inviting — only a 404 does', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(membershipsApi, 'addMember').mockRejectedValue(
      new ApiError(409, 'Este usuario ya es miembro de esta organización.'),
    );
    const inviteSpy = vi.spyOn(membershipsApi, 'createInvitation');
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('No hay usuarios registrados todavía.');
    await user.click(screen.getByRole('button', { name: '+ Agregar usuario' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar usuario' });
    await user.type(
      within(dialog).getByLabelText('Correo electrónico'),
      'ya-existe@kylumenergy.com',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Agregar usuario' }),
    );

    await screen.findByText('Este usuario ya es miembro de esta organización.');
    expect(inviteSpy).not.toHaveBeenCalled();
  });
});

describe('MembersSection — invitation fallback for a brand-new email', () => {
  it('a 404 from addMember falls back to creating an invitation, shown with a copyable URL and no password', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([]);
    vi.spyOn(membershipsApi, 'addMember').mockRejectedValue(
      new ApiError(
        404,
        'No existe una cuenta MOVOS con este correo electrónico.',
      ),
    );
    const inviteSpy = vi
      .spyOn(membershipsApi, 'createInvitation')
      .mockResolvedValue({
        id: 'inv-1',
        email: 'nueva@kylumenergy.com',
        role: 'VIEWER',
        expiresAt: '2026-08-27T00:00:00.000Z',
        createdAt: '2026-08-25T00:00:00.000Z',
        token: 'super-secret-one-time-token',
      });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('No hay usuarios registrados todavía.');
    await user.click(screen.getByRole('button', { name: '+ Agregar usuario' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar usuario' });
    await user.type(
      within(dialog).getByLabelText('Correo electrónico'),
      'nueva@kylumenergy.com',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Agregar usuario' }),
    );

    await waitFor(() =>
      expect(inviteSpy).toHaveBeenCalledWith('nueva@kylumenergy.com', 'OWNER'),
    );

    const resultDialog = await screen.findByRole('dialog', {
      name: 'Invitación creada',
    });
    expect(
      within(resultDialog).getByText(/super-secret-one-time-token/),
    ).toBeInTheDocument();
    // No temporary password ever shown.
    expect(
      within(resultDialog).queryByText(/contraseña/i),
    ).not.toBeInTheDocument();

    await user.click(
      within(resultDialog).getByRole('button', {
        name: 'Copiar enlace de invitación',
      }),
    );
    // Observable proof the copy succeeded, rather than asserting on which
    // mock object the browser's Clipboard API happened to route through.
    expect(
      await within(resultDialog).findByRole('button', { name: 'Copiado' }),
    ).toBeInTheDocument();

    // Two "Cerrar" controls exist in this dialog (the X icon and the
    // explicit bottom button) — the bottom one is the real confirm action.
    const closeButtons = within(resultDialog).getAllByRole('button', {
      name: 'Cerrar',
    });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(
      await screen.findByText('nueva@kylumenergy.com'),
    ).toBeInTheDocument(); // now listed under Invitaciones pendientes
  });
});

describe('MembersSection — role change confirmation', () => {
  it('changing the role selector opens a confirmation before calling the API', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([member()]);
    const updateSpy = vi.spyOn(membershipsApi, 'updateMember');
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('operador@kylumenergy.com');

    await user.selectOptions(
      screen.getByLabelText('Rol de Operador Kylum'),
      'ADMIN',
    );

    expect(
      await screen.findByRole('dialog', { name: 'Confirmar cambio de rol' }),
    ).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('mem-1', {
        role: 'ADMIN',
        status: undefined,
      }),
    );
  });
});

describe('MembersSection — deactivate confirmation', () => {
  it('clicking Desactivar opens confirmation and calls the API with status SUSPENDED', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([member()]);
    const updateSpy = vi
      .spyOn(membershipsApi, 'updateMember')
      .mockResolvedValue(member({ status: 'SUSPENDED' }));
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('operador@kylumenergy.com');

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(
      await screen.findByText(
        'Este usuario perderá acceso a la organización de inmediato.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('mem-1', {
        role: undefined,
        status: 'SUSPENDED',
      }),
    );
  });

  it('surfaces the backend final-owner message honestly', async () => {
    mockAuth('OWNER');
    vi.spyOn(membershipsApi, 'listMembers').mockResolvedValue([
      member({ role: 'OWNER', displayName: 'Única Dueña' }),
    ]);
    vi.spyOn(membershipsApi, 'updateMember').mockRejectedValue(
      new ApiError(
        409,
        'No es posible: la organización debe conservar al menos un OWNER activo.',
      ),
    );
    const user = userEvent.setup();

    render(<MembersSection />);
    await screen.findByText('Única Dueña');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText(
        'No es posible: la organización debe conservar al menos un OWNER activo.',
      ),
    ).toBeInTheDocument();
  });
});
