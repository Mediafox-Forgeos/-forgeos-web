import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiSite } from '@mediafox/shared-types';

import { SiteSelectionList } from './site-selection-list';
import { apiClient } from '@/lib/api-client';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function site(overrides: Partial<ApiSite> = {}): ApiSite {
  return {
    id: 's1',
    organizationId: 'o1',
    name: 'Bogotá Centro',
    slug: 'bogota-centro',
    city: 'Bogotá',
    address: 'Cra 7',
    latitude: null,
    longitude: null,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    formattedAddress: null,
    addressLine1: null,
    addressLine2: null,
    state: null,
    postalCode: null,
    countryCode: null,
    googlePlaceId: null,
    locationSource: 'MANUAL',
    locationValidationStatus: 'UNVALIDATED',
    locationValidatedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SiteSelectionList', () => {
  it('shows a loading state before data resolves', () => {
    vi.spyOn(apiClient, 'get').mockReturnValue(new Promise(() => {}));
    const { container } = render(<SiteSelectionList />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('lists real sites, linking each to its Site detail page', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      site({ id: 's1', name: 'Bogotá Centro' }),
      site({ id: 's2', name: 'Medellín Poblado' }),
    ]);
    render(<SiteSelectionList />);

    expect(await screen.findByText('Bogotá Centro')).toBeInTheDocument();
    expect(screen.getByText('Medellín Poblado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bogotá Centro/ })).toHaveAttribute(
      'href',
      '/sites/s1',
    );
  });

  it('never renders fabricated charging metrics (chargerCount, connectorCount, availability)', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([site()]);
    render(<SiteSelectionList />);

    await screen.findByText('Bogotá Centro');
    // The old mock Station type carried chargerCount/connectorCount/
    // availabilityPercent — this gateway shows only real Site fields
    // (name, city, status), never a station/connector count or a "%".
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kW/)).not.toBeInTheDocument();
  });

  it('shows an empty state when the organization has no sites', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([]);
    render(<SiteSelectionList />);

    expect(
      await screen.findByText('No hay sitios registrados todavía.'),
    ).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('boom'));
    render(<SiteSelectionList />);

    expect(
      await screen.findByText('No fue posible cargar los sitios.'),
    ).toBeInTheDocument();
  });
});
