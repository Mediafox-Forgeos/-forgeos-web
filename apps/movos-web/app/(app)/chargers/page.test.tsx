import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { apiClient } from '@/lib/api-client';
import ChargersPage from './page';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('/chargers', () => {
  it('explains that a Site must be selected first, instead of listing mock chargers', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);
    render(<ChargersPage />);

    expect(
      screen.getByText(/Las estaciones de carga pertenecen a un Sitio/),
    ).toBeInTheDocument();
    // Mock fixture identifiers must never appear here.
    expect(screen.queryByText('CHG-01')).not.toBeInTheDocument();
    expect(screen.queryByText('Kempower')).not.toBeInTheDocument();
    await screen.findByText('No hay sitios registrados todavía.');
  });
});
