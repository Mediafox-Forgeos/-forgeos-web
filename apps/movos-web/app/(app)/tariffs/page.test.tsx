import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TariffsPage from './page';

// WO-ARGOS-090 §4, §13.3/§13.4 — Tariff Engine does not exist. This page
// must contain no fake prices/currencies/site assignments, and must be
// honest that the capability is not yet available.
describe('/tariffs', () => {
  it('shows an honest placeholder with no fabricated tariff values', () => {
    render(<TariffsPage />);

    expect(
      screen.getAllByText('El motor de tarifas estará disponible próximamente.')
        .length,
    ).toBeGreaterThan(0);
    // No demo prices, currencies, or tariff status values anywhere on the
    // page — the old fake table's exact status labels.
    expect(screen.queryByText(/\$\s?\d/)).not.toBeInTheDocument();
    expect(screen.queryByText('Activa')).not.toBeInTheDocument();
    expect(screen.queryByText('Borrador')).not.toBeInTheDocument();
  });

  it('describes what will be configurable without implying it exists today', () => {
    render(<TariffsPage />);

    expect(screen.getByText('Precio por kWh')).toBeInTheDocument();
    expect(screen.getByText('Moneda')).toBeInTheDocument();
  });
});
