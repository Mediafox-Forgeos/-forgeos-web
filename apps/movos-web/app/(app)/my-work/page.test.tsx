import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiWorkOrder } from '@mediafox/shared-types';

import * as usePolledResourceModule from '@/components/operator/use-polled-resource';
import MyWorkPage from './page';

// WO-ARGOS-050 — "Historial" section regression coverage. Pins "today" so
// the today/historial split (based on the browser's local calendar day,
// same basis "Completadas hoy" has always used) is deterministic.
const TODAY = new Date('2026-08-16T12:00:00.000Z');

function workOrder(overrides: Partial<ApiWorkOrder> = {}): ApiWorkOrder {
  return {
    id: 'wo-1',
    title: 'Orden de prueba',
    description: 'Descripción de prueba.',
    status: 'RESOLVED',
    priority: 'MEDIUM',
    source: 'MANUAL',
    stationId: 'station-1',
    stationName: 'Estación 1',
    assignedMemberId: 'tech-1',
    assignedMemberName: 'Javier Cabal Jr.',
    assignedAt: '2026-08-15T06:00:00.000Z',
    startedAt: '2026-08-15T06:05:00.000Z',
    scheduledAt: null,
    resolvedAt: '2026-08-15T06:10:00.000Z',
    notes: 'OK',
    createdAt: '2026-08-15T05:55:00.000Z',
    updatedAt: '2026-08-15T06:10:00.000Z',
    visitLocation: {
      siteName: 'Site 1',
      stationName: 'Estación 1',
      formattedAddress: 'Calle 1, Cali',
      latitude: 3.45,
      longitude: -76.53,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('/my-work — Historial (WO-ARGOS-050)', () => {
  it('puts a WorkOrder resolved today under "Completadas hoy", not "Historial"', () => {
    const resolvedToday = workOrder({
      id: 'wo-today',
      title: 'Resuelta hoy',
      // Same instant as the fake system time — guarantees the same local
      // calendar day regardless of the test runner's own timezone.
      resolvedAt: TODAY.toISOString(),
    });
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [resolvedToday],
      loading: false,
      error: false,
      refetch: () => {},
    });

    render(<MyWorkPage />);

    const completedHoySection = screen
      .getByRole('heading', { name: 'Completadas hoy' })
      .closest('div')!.parentElement!;
    expect(completedHoySection).toHaveTextContent('Resuelta hoy');

    const historialSection = screen
      .getByRole('heading', { name: 'Historial' })
      .closest('div')!.parentElement!;
    expect(historialSection).not.toHaveTextContent('Resuelta hoy');
    expect(historialSection).toHaveTextContent(
      'Todavía no tienes tareas completadas de días anteriores.',
    );
  });

  it('puts a WorkOrder resolved on a previous day under "Historial", not "Completadas hoy"', () => {
    const resolvedYesterday = workOrder({
      id: 'wo-yesterday',
      title: 'Resuelta ayer',
      resolvedAt: '2026-08-15T06:10:00.000Z',
    });
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [resolvedYesterday],
      loading: false,
      error: false,
      refetch: () => {},
    });

    render(<MyWorkPage />);

    const historialSection = screen
      .getByRole('heading', { name: 'Historial' })
      .closest('div')!.parentElement!;
    expect(historialSection).toHaveTextContent('Resuelta ayer');

    const completedHoySection = screen
      .getByRole('heading', { name: 'Completadas hoy' })
      .closest('div')!.parentElement!;
    expect(completedHoySection).not.toHaveTextContent('Resuelta ayer');
    expect(completedHoySection).toHaveTextContent(
      'Todavía no has completado ninguna tarea hoy.',
    );
  });

  it('never lists the same WorkOrder in both sections', () => {
    const resolvedToday = workOrder({
      id: 'wo-today',
      title: 'Resuelta hoy',
      resolvedAt: TODAY.toISOString(),
    });
    const resolvedYesterday = workOrder({
      id: 'wo-yesterday',
      title: 'Resuelta ayer',
      resolvedAt: '2026-08-15T06:10:00.000Z',
    });
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [resolvedToday, resolvedYesterday],
      loading: false,
      error: false,
      refetch: () => {},
    });

    render(<MyWorkPage />);

    expect(screen.getAllByText('Resuelta hoy')).toHaveLength(1);
    expect(screen.getAllByText('Resuelta ayer')).toHaveLength(1);
  });

  it('sorts Historial newest-first', () => {
    const older = workOrder({
      id: 'wo-older',
      title: 'La más antigua',
      resolvedAt: '2026-08-10T06:10:00.000Z',
    });
    const newer = workOrder({
      id: 'wo-newer',
      title: 'La más reciente',
      resolvedAt: '2026-08-15T06:10:00.000Z',
    });
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [older, newer],
      loading: false,
      error: false,
      refetch: () => {},
    });

    render(<MyWorkPage />);

    const historialSection = screen
      .getByRole('heading', { name: 'Historial' })
      .closest('div')!.parentElement!;
    const rendered = historialSection.textContent!;
    expect(rendered.indexOf('La más reciente')).toBeLessThan(
      rendered.indexOf('La más antigua'),
    );
  });

  it('an IN_PROGRESS WorkOrder does not appear in Historial even if old', () => {
    const inProgress = workOrder({
      id: 'wo-in-progress',
      title: 'Todavía en progreso',
      status: 'IN_PROGRESS',
      resolvedAt: null,
      createdAt: '2026-08-01T06:00:00.000Z',
    });
    vi.spyOn(usePolledResourceModule, 'usePolledResource').mockReturnValue({
      data: [inProgress],
      loading: false,
      error: false,
      refetch: () => {},
    });

    render(<MyWorkPage />);

    const historialSection = screen
      .getByRole('heading', { name: 'Historial' })
      .closest('div')!.parentElement!;
    expect(historialSection).not.toHaveTextContent('Todavía en progreso');
  });
});
