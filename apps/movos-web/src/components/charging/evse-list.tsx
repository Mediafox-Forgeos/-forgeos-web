'use client';

import Link from 'next/link';
import { Plug, Plus } from 'lucide-react';
import * as React from 'react';
import type { ApiEvse } from '@mediafox/shared-types';

import { EmptyState } from '@/components/movos/empty-state';
import { ApiEvseStatusBadge } from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { listEvsesByChargingStation } from '@/lib/charging-api';
import { EvseFormModal } from './evse-form-modal';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

interface EvseListProps {
  chargingStationId: string;
  siteId: string;
  canManage: boolean;
}

/**
 * Availability is only ever computed here, live, from statuses the API just
 * returned — never fabricated or carried over from mock data. With zero
 * EVSEs there is nothing honest to compute, so it's omitted rather than
 * shown as 0% or 100%.
 */
function computeAvailabilityPercent(evses: ApiEvse[]): number | null {
  if (evses.length === 0) return null;
  const available = evses.filter((e) => e.status === 'AVAILABLE').length;
  return Math.round((available / evses.length) * 100);
}

export function EvseList({
  chargingStationId,
  siteId,
  canManage,
}: EvseListProps) {
  const [evses, setEvses] = React.useState<ApiEvse[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data = await listEvsesByChargingStation(chargingStationId);
      setEvses(data);
      setState('ready');
    } catch (err) {
      setState(
        err instanceof ApiError && err.status === 404 ? 'notfound' : 'error',
      );
    }
  }, [chargingStationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleCreated(evse: ApiEvse): void {
    setEvses((prev) => [evse, ...prev]);
  }

  const availabilityPercent = computeAvailabilityPercent(evses);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">EVSEs</h3>
          {state === 'ready' && (
            <p
              className="text-muted-foreground mt-1 text-xs"
              data-testid="evse-summary"
            >
              {evses.length} {evses.length === 1 ? 'EVSE' : 'EVSEs'}
              {' · '}
              {availabilityPercent !== null
                ? `${availabilityPercent}% disponible`
                : 'Disponibilidad no disponible aún'}
            </p>
          )}
        </div>
        {canManage && state === 'ready' && evses.length > 0 && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Crear EVSE
          </Button>
        )}
      </div>

      {state === 'loading' && <EvseListSkeleton />}

      {state === 'notfound' && (
        <EmptyState title="Esta estación de carga no está disponible." />
      )}

      {state === 'error' && (
        <EmptyState
          icon={Plug}
          title="No fue posible cargar los EVSEs."
          description="Verifica tu conexión con MOVOS e intenta nuevamente."
          action={
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      )}

      {state === 'ready' && evses.length === 0 && (
        <EmptyState
          icon={Plug}
          title="No hay EVSEs registrados en esta estación."
          action={
            canManage ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Crear EVSE
              </Button>
            ) : undefined
          }
        />
      )}

      {state === 'ready' && evses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {evses.map((evse) => (
            <Link
              key={evse.id}
              href={`/sites/${siteId}/charging-stations/${chargingStationId}/evses/${evse.id}`}
            >
              <Card className="hover:border-movos-blue/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {evse.name ?? evse.externalId ?? evse.id}
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {evse.maxPowerKw != null
                          ? `${evse.maxPowerKw} kW`
                          : 'Potencia sin especificar'}
                        {evse.currentType ? ` · ${evse.currentType}` : ''}
                      </p>
                    </div>
                    <ApiEvseStatusBadge status={evse.status} />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <EvseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        chargingStationId={chargingStationId}
        onSaved={handleCreated}
      />
    </div>
  );
}

function EvseListSkeleton() {
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
