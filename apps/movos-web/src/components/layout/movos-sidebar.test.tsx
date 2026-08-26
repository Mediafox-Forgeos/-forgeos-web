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
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import * as authContext from '@/context/auth-context';
import { MovosSidebar } from './movos-sidebar';

vi.mock('@/context/auth-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/context/auth-context')>();
  return { ...actual, useAuth: vi.fn() };
});

// WO-ARGOS-090 §13.9 — every primary nav item still resolves to a real
// route after the honest-surfaces changes (redirect/placeholder, not a
// removed or broken link).
describe('MovosSidebar — primary navigation', () => {
  it('every operator nav item still links somewhere real', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: { displayName: 'Operador', email: 'op@kylum.co' },
      currentOrg: { name: 'Kylum Energy' },
      membership: { role: 'OWNER' },
      logout: vi.fn(),
    } as unknown as ReturnType<typeof authContext.useAuth>);

    render(<MovosSidebar />);

    const expected: Record<string, string> = {
      Operaciones: '/dashboard',
      'Órdenes de trabajo': '/work-orders',
      Sitios: '/sites',
      Estaciones: '/stations',
      Cargadores: '/chargers',
      Conectores: '/connectors',
      Sesiones: '/sessions',
      Alertas: '/alerts',
      Usuarios: '/users',
      Tarifas: '/tariffs',
      Reportes: '/reports',
      Configuración: '/settings',
    };

    for (const [label, href] of Object.entries(expected)) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }
  });
});
