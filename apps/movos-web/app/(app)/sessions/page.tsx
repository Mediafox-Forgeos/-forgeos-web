'use client';

import * as React from 'react';
import Link from 'next/link';

import type { ApiChargingSession, ApiSite } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { ApiChargingSessionStatusBadge } from '@/components/movos/api-charging-status-badges';
import { apiClient } from '@/lib/api-client';
import { formatDateTime, formatRelative } from '@/lib/format';

const STATUS_OPTIONS = [
  'PENDING',
  'AUTHORIZED',
  'STARTING',
  'ACTIVE',
  'SUSPENDED',
  'OFFLINE',
  'STOPPING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

/**
 * WO-ARGOS-023 (Operational Consistency Hardening). Replaces the previous
 * fixture-backed page (data/sessions.ts) — that page showed fictional
 * sessions attached to sites that don't exist in this organization's real
 * data, directly contradicting the real ACTIVE_SESSIONS widget on the
 * operator dashboard one click away. See
 * docs/product/OPERATOR_USABILITY_REVIEW.md, confusion finding #1.
 *
 * The status/site filters were previously rendered but disabled ("Filtros
 * disponibles cuando se conecte el backend") — GET /sessions has always
 * supported both server-side, so this enables what the UI already
 * promised rather than adding new surface.
 */
export default function SessionsPage() {
  const [sessions, setSessions] = React.useState<ApiChargingSession[] | null>(
    null,
  );
  const [sites, setSites] = React.useState<ApiSite[]>([]);
  const [status, setStatus] = React.useState('');
  const [siteId, setSiteId] = React.useState('');
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    apiClient
      .get<ApiSite[]>('/sites')
      .then(setSites)
      .catch(() => setSites([]));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setSessions(null);
    setError(false);

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (siteId) params.set('siteId', siteId);
    const query = params.toString();

    apiClient
      .get<ApiChargingSession[]>(`/sessions${query ? `?${query}` : ''}`)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [status, siteId]);

  const columns: Column<ApiChargingSession>[] = [
    {
      key: 'id',
      header: 'Sesión',
      render: (s) => (
        <Link
          href={`/sessions/${s.id}`}
          className="hover:text-movos-blue font-mono text-xs"
        >
          {s.id}
        </Link>
      ),
    },
    { key: 'site', header: 'Sitio', render: (s) => s.siteName },
    {
      key: 'station',
      header: 'Estación',
      render: (s) => s.chargingStationName,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (s) => <ApiChargingSessionStatusBadge status={s.status} />,
    },
    {
      key: 'energy',
      header: 'Energía',
      render: (s) => `${(s.energyWh / 1000).toFixed(1)} kWh`,
    },
    {
      key: 'started',
      header: 'Inicio',
      render: (s) => formatDateTime(s.startedAt),
    },
    {
      key: 'duration',
      header: 'Duración',
      render: (s) =>
        s.endedAt
          ? formatRelative(s.startedAt).replace('hace ', '') +
            ' (finalizada ' +
            formatRelative(s.endedAt) +
            ')'
          : `en curso, iniciada ${formatRelative(s.startedAt)}`,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operación"
        title="Sesiones"
        description="Historial y sesiones en curso a través de toda la red."
      />

      <div className="mb-4 mt-8 flex flex-wrap items-center gap-2">
        <select
          className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Estado</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          aria-label="Filtrar por sitio"
        >
          <option value="">Sitio</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-muted-foreground text-sm">
          No se pudieron cargar las sesiones.
        </p>
      )}
      {!error && sessions === null && (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      )}
      {!error && sessions !== null && (
        <DataTable
          columns={columns}
          rows={sessions}
          getRowKey={(s) => s.id}
          emptyLabel="No hay sesiones para los filtros seleccionados."
        />
      )}
    </PageContainer>
  );
}
