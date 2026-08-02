'use client';

import { useParams } from 'next/navigation';
import * as React from 'react';
import type { ApiChargingStation, ApiSite } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import {
  ApiChargingStationStatusBadge,
  ApiConnectivityStatusBadge,
} from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { getChargingStation } from '@/lib/charging-api';
import { useAuth } from '@/context/auth-context';
import { EvseList } from '@/components/charging/evse-list';
import { ChargingStationFormModal } from '@/components/charging/charging-station-form-modal';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export default function ChargingStationDetailPage() {
  const params = useParams<{ siteId: string; stationId: string }>();
  const { siteId, stationId } = params;
  const { membership } = useAuth();
  const canManage =
    membership?.role === 'OWNER' ||
    membership?.role === 'ADMIN' ||
    membership?.role === 'OPERATOR';

  const [station, setStation] = React.useState<ApiChargingStation | null>(null);
  const [site, setSite] = React.useState<ApiSite | null>(null);
  const [state, setState] = React.useState<LoadState>('loading');
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data = await getChargingStation(stationId);
      setStation(data);
      try {
        setSite(await apiClient.get<ApiSite>(`/sites/${data.siteId}`));
      } catch {
        // Breadcrumb enrichment only — the station itself already loaded.
      }
      setState('ready');
    } catch (err) {
      setState(
        err instanceof ApiError && err.status === 404 ? 'notfound' : 'error',
      );
    }
  }, [stationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <PageContainer>
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-40 animate-pulse rounded" />
      </PageContainer>
    );
  }

  if (state === 'notfound') {
    return (
      <PageContainer>
        <EmptyState title="Estación de carga no encontrada." />
      </PageContainer>
    );
  }

  if (state === 'error' || !station) {
    return (
      <PageContainer>
        <EmptyState title="No fue posible cargar la estación de carga." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sitios', href: '/sites' },
          { label: site?.name ?? siteId, href: `/sites/${siteId}` },
          { label: station.name },
        ]}
        title={station.name}
        description={
          station.manufacturer || station.model
            ? `${station.manufacturer ?? ''} ${station.model ?? ''}`.trim()
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <ApiChargingStationStatusBadge status={station.status} />
            <ApiConnectivityStatusBadge status={station.connectivityStatus} />
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                Editar
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <DetailCard label="Código" value={station.code ?? 'Sin código'} />
        <DetailCard
          label="Número de serie"
          value={station.serialNumber ?? 'Sin especificar'}
        />
        <DetailCard
          label="Protocolo"
          value={station.protocol ?? 'Sin especificar'}
        />
        <DetailCard
          label="Última conexión vista"
          value={
            station.lastSeenAt ? formatDateTime(station.lastSeenAt) : 'Nunca'
          }
        />
        <DetailCard
          label="Versión de protocolo (última conexión)"
          value={station.lastProtocolVersion ?? 'Sin especificar'}
        />
      </div>

      <div className="mt-8">
        <EvseList
          chargingStationId={station.id}
          siteId={siteId}
          canManage={canManage}
        />
      </div>

      <ChargingStationFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        station={station}
        onSaved={setStation}
      />
    </PageContainer>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-2 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
