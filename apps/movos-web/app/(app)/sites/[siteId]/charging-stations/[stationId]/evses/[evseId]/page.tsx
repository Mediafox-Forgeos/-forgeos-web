'use client';

import { useParams } from 'next/navigation';
import * as React from 'react';
import type {
  ApiChargingStation,
  ApiEvseListItem,
  ApiSite,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import {
  ApiEvseStatusBadge,
  OperationalStatusBadge,
  RequiresAttentionIndicator,
} from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatConnectorAvailability } from '@/lib/format';
import { getChargingStation, getEvse } from '@/lib/charging-api';
import { useAuth } from '@/context/auth-context';
import { ConnectorList } from '@/components/charging/connector-list';
import { EvseFormModal } from '@/components/charging/evse-form-modal';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export default function EvseDetailPage() {
  const params = useParams<{
    siteId: string;
    stationId: string;
    evseId: string;
  }>();
  const { siteId, stationId, evseId } = params;
  const { membership } = useAuth();
  const canManage =
    membership?.role === 'OWNER' ||
    membership?.role === 'ADMIN' ||
    membership?.role === 'OPERATOR';

  const [evse, setEvse] = React.useState<ApiEvseListItem | null>(null);
  const [station, setStation] = React.useState<ApiChargingStation | null>(null);
  const [site, setSite] = React.useState<ApiSite | null>(null);
  const [state, setState] = React.useState<LoadState>('loading');
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data = await getEvse(evseId);
      setEvse(data);
      try {
        const stationData = await getChargingStation(data.chargingStationId);
        setStation(stationData);
        setSite(await apiClient.get<ApiSite>(`/sites/${stationData.siteId}`));
      } catch {
        // Breadcrumb enrichment only — the EVSE itself already loaded.
      }
      setState('ready');
    } catch (err) {
      setState(
        err instanceof ApiError && err.status === 404 ? 'notfound' : 'error',
      );
    }
  }, [evseId]);

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
        <EmptyState title="EVSE no encontrado." />
      </PageContainer>
    );
  }

  if (state === 'error' || !evse) {
    return (
      <PageContainer>
        <EmptyState title="No fue posible cargar el EVSE." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sitios', href: '/sites' },
          { label: site?.name ?? siteId, href: `/sites/${siteId}` },
          {
            label: station?.name ?? stationId,
            href: `/sites/${siteId}/charging-stations/${stationId}`,
          },
          { label: evse.name ?? evse.externalId ?? evse.id },
        ]}
        title={evse.name ?? evse.externalId ?? evse.id}
        description={
          evse.maxPowerKw != null ? `${evse.maxPowerKw} kW` : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <OperationalStatusBadge status={evse.operationalStatus} />
            <RequiresAttentionIndicator reasons={evse.attentionReasons} />
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
        <DetailCard
          label="Conectores disponibles"
          value={formatConnectorAvailability(
            evse.connectorSummary.available,
            evse.connectorSummary.total,
          )}
        />
        <DetailCard
          label="Identificador de protocolo"
          value={evse.externalId ?? 'Sin especificar'}
        />
        <DetailCard
          label="Tipo de corriente"
          value={evse.currentType ?? 'Sin especificar'}
        />
        <DetailCard label="Fases" value={evse.phaseType ?? 'Sin especificar'} />
        <DetailCard
          label="Estado administrativo"
          value=""
          badge={<ApiEvseStatusBadge status={evse.status} />}
        />
      </div>

      <div className="mt-8">
        <ConnectorList evseId={evse.id} canManage={canManage} />
      </div>

      <EvseFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        evse={evse}
        onSaved={() => void load()}
      />
    </PageContainer>
  );
}

function DetailCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        {badge ? (
          <div className="mt-2">{badge}</div>
        ) : (
          <p className="mt-2 text-lg font-semibold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
