import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ReportsPage from './page';

// WO-ARGOS-090 §6, §13.7/§13.8 — audit finding: unlike /users, /tariffs and
// /alerts, /reports was ALREADY honest before this work order (every card
// carries "Próximamente", every download button is disabled, and the
// catalogue in `@/data/reports` contains only titles/descriptions of what
// will be generated — never a fabricated metric, count, or figure). No page
// change was made; this test only locks that finding in as a regression
// guard, per this WO's own required test matrix.
describe('/reports', () => {
  it('contains no fabricated report metrics — every report is explicitly not-yet-available', () => {
    render(<ReportsPage />);

    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole('button', {
      name: /Descargar/,
    })) {
      expect(button).toBeDisabled();
    }
    // No production-looking numeric figures anywhere on the page.
    expect(screen.queryByText(/^\d[\d.,]*%?$/)).not.toBeInTheDocument();
  });
});
