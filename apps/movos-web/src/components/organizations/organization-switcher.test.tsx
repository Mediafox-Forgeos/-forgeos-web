import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiOrganization } from '@mediafox/shared-types';

import { OrganizationSwitcher } from './organization-switcher';
import { useAuth } from '@/context/auth-context';

vi.mock('@/context/auth-context', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

function org(overrides: Partial<ApiOrganization> = {}): ApiOrganization {
  return {
    id: 'o1',
    name: 'Alpha',
    slug: 'alpha',
    status: 'ACTIVE',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrganizationSwitcher (variant="dropdown")', () => {
  it('renders a static label with no dropdown affordance for a single-organization user', () => {
    const alpha = org();
    mockUseAuth.mockReturnValue({
      currentOrg: alpha,
      organizations: [alpha],
      selectOrganization: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(<OrganizationSwitcher />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a toggle listing every organization for a multi-organization user', () => {
    const alpha = org({ id: 'o1', name: 'Alpha' });
    const beta = org({ id: 'o2', name: 'Beta' });
    mockUseAuth.mockReturnValue({
      currentOrg: alpha,
      organizations: [alpha, beta],
      selectOrganization: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(<OrganizationSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(screen.getByRole('option', { name: /Beta/ })).toBeInTheDocument();
  });

  // DEC-022 Invariant 4: switching only ever happens through this explicit
  // call — there is no automatic/implicit re-selection anywhere else.
  it('calls selectOrganization when a different organization is chosen', async () => {
    const alpha = org({ id: 'o1', name: 'Alpha' });
    const beta = org({ id: 'o2', name: 'Beta' });
    const selectOrganization = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      currentOrg: alpha,
      organizations: [alpha, beta],
      selectOrganization,
    } as unknown as ReturnType<typeof useAuth>);

    render(<OrganizationSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(screen.getByRole('option', { name: /Beta/ }));

    await waitFor(() => expect(selectOrganization).toHaveBeenCalledWith('o2'));
  });

  it('shows an error and stays usable if selection fails', async () => {
    const alpha = org({ id: 'o1', name: 'Alpha' });
    const beta = org({ id: 'o2', name: 'Beta' });
    const selectOrganization = vi.fn().mockRejectedValue(new Error('403'));
    mockUseAuth.mockReturnValue({
      currentOrg: alpha,
      organizations: [alpha, beta],
      selectOrganization,
    } as unknown as ReturnType<typeof useAuth>);

    render(<OrganizationSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(screen.getByRole('option', { name: /Beta/ }));

    expect(
      await screen.findByText(
        'No se pudo cambiar de organización. Intenta de nuevo.',
      ),
    ).toBeInTheDocument();
  });

  it('does not call selectOrganization when re-selecting the already-active organization', () => {
    const alpha = org({ id: 'o1', name: 'Alpha' });
    const beta = org({ id: 'o2', name: 'Beta' });
    const selectOrganization = vi.fn();
    mockUseAuth.mockReturnValue({
      currentOrg: alpha,
      organizations: [alpha, beta],
      selectOrganization,
    } as unknown as ReturnType<typeof useAuth>);

    render(<OrganizationSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    fireEvent.click(screen.getByRole('option', { name: /Alpha/ }));

    expect(selectOrganization).not.toHaveBeenCalled();
  });
});

describe('OrganizationSwitcher (variant="list")', () => {
  // DEC-022 Objective 3, Case B: 0/>1 memberships must show an explicit
  // full-page selector — never an automatic organizations[0] pick.
  it('lists every organization and lets the user pick one explicitly', async () => {
    const alpha = org({ id: 'o1', name: 'Alpha' });
    const beta = org({ id: 'o2', name: 'Beta' });
    const selectOrganization = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      currentOrg: null,
      organizations: [alpha, beta],
      selectOrganization,
    } as unknown as ReturnType<typeof useAuth>);

    render(<OrganizationSwitcher variant="list" />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Beta'));
    await waitFor(() => expect(selectOrganization).toHaveBeenCalledWith('o2'));
  });
});
