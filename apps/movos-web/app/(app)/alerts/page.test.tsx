import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import AlertsPage from './page';

// WO-ARGOS-090 §5, §13.5/§13.6 — /alerts must contain no fabricated alert
// records, and must point at the real operational source (Unified
// Attention on Operaciones) instead of duplicating it with fake data.
describe('/alerts', () => {
  it('shows an honest placeholder pointing to the real attention surface, no fabricated alerts', () => {
    render(<AlertsPage />);

    expect(
      screen.getAllByText(
        'Las alertas operativas se muestran en Centro de Operaciones.',
      ).length,
    ).toBeGreaterThan(0);
    // The old fake page's exact demo alert titles must never appear.
    expect(screen.queryByText('Latido perdido')).not.toBeInTheDocument();
    expect(screen.queryByText('Falla de conector')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconocer')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolver')).not.toBeInTheDocument();

    const link = screen.getByRole('link', {
      name: 'Ir a Centro de Operaciones',
    });
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});
