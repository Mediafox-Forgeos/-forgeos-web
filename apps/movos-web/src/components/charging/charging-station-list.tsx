'use client';

import Link from 'next/link';
import { Plus, ServerCog } from 'lucide-react';
import * as React from 'react';
import type { ApiChargingStation } from '@mediafox/shared-types';

import { EmptyState } from '@/components/movos/empty-state';
import { ApiChargingStationStatusBadge } from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listChargingStationsBySite } from '@/lib/charging-api';
import { ChargingStationFormModal } from './charging-station-form-modal';

type LoadState = 'loading' | 'ready' | 'error';

interface ChargingStationListProps {
  siteId: string;
  canManage: boolean;
}

export function ChargingStationList({
  siteId,
  canManage,
}: ChargingStationListProps) {
  const [stations, setStations] = React.useState<ApiChargingStation[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data = await listChargingStationsBySite(siteId);
      setStations(data);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [siteId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleCreated(station: ApiChargingStation): void {
    setStations((prev) => [station, ...prev]);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Estaciones de carga</h3>
        {canManage && stations.length > 0 && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Crear estación
          </Button>
        )}
      </div>

      {state === 'loading' && <ChargingStationListSkeleton />}

      {state === 'error' && (
        <EmptyState
          icon={ServerCog}
          title="No fue posible cargar las estaciones de carga."
          description="Verifica tu conexión con MOVOS e intenta nuevamente."
          action={
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      )}

      {state === 'ready' && stations.length === 0 && (
        <EmptyState
          icon={ServerCog}
          title="No hay estaciones de carga registradas en este sitio."
          action={
            canManage ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Crear estación
              </Button>
            ) : undefined
          }
        />
      )}

      {state === 'ready' && stations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {stations.map((station) => (
            <Link
              key={station.id}
              href={`/sites/${siteId}/charging-stations/${station.id}`}
            >
              <Card className="hover:border-movos-blue/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {station.name}
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {station.code ?? 'Sin código'}
                        {station.manufacturer
                          ? ` · ${station.manufacturer}`
                          : ''}
                      </p>
                    </div>
                    <ApiChargingStationStatusBadge status={station.status} />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ChargingStationFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        siteId={siteId}
        onSaved={handleCreated}
      />
    </div>
  );
}

function ChargingStationListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1].map((key) => (
        <Card key={key} className="h-24 animate-pulse">
          <CardContent className="pt-6">
            <div className="bg-muted h-4 w-1/2 rounded" />
            <div className="bg-muted mt-3 h-3 w-3/4 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
