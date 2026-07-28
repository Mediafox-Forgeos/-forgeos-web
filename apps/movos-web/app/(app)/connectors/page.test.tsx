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
import ConnectorsPage from './page';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('/connectors', () => {
  it('explains that a Site (then a Station, then an EVSE) must be selected first, instead of listing mock connectors', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);
    render(<ConnectorsPage />);

    expect(
      screen.getByText(/Los conectores pertenecen a un EVSE/),
    ).toBeInTheDocument();
    // Mock fixture identifiers must never appear here.
    expect(screen.queryByText('A1')).not.toBeInTheDocument();
    expect(screen.queryByText('CCS2')).not.toBeInTheDocument();
    await screen.findByText('No hay sitios registrados todavía.');
  });
});
