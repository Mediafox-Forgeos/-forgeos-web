'use client';

import Link from 'next/link';
import { Plug, Plus } from 'lucide-react';
import * as React from 'react';
import type { ApiEvseListItem } from '@mediafox/shared-types';

import { EmptyState } from '@/components/movos/empty-state';
import {
  OperationalStatusBadge,
  RequiresAttentionIndicator,
} from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { formatConnectorAvailability } from '@/lib/format';
import { listEvsesByChargingStation } from '@/lib/charging-api';
import { EvseFormModal } from './evse-form-modal';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

interface EvseListProps {
  chargingStationId: string;
  siteId: string;
  canManage: boolean;
}

/**
 * WO-ARGOS-056 — connector-based availability, aggregated across every EVSE
 * of this station. Replaces the old Evse.status-based "% disponible" metric
 * (evse.status === 'AVAILABLE' count), which measured administrative status
 * with zero relation to real charging activity — see
 * evse-operational-status.ts for the full reasoning. `available`/`total`
 * here are always the real connector-status tallies the API already
 * computed; nothing is estimated here.
 */
function aggregateConnectorAvailability(evses: ApiEvseListItem[]): {
  available: number;
  total: number;
} {
  return evses.reduce(
    (acc, evse) => ({
      available: acc.available + evse.connectorSummary.available,
      total: acc.total + evse.connectorSummary.total,
    }),
    { available: 0, total: 0 },
  );
}

export function EvseList({
  chargingStationId,
  siteId,
  canManage,
}: EvseListProps) {
  const [evses, setEvses] = React.useState<ApiEvseListItem[]>([]);
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

  // WO-ARGOS-056 — the create response is a plain ApiEvse (no connector/
  // session evidence yet — a brand-new EVSE has none). Refetching the list
  // is simpler and stays accurate rather than synthesizing a ListItem's
  // extra fields (operationalStatus/connectorSummary/parent names) here.
  function handleCreated(): void {
    void load();
  }

  const { available, total } = aggregateConnectorAvailability(evses);

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
              {formatConnectorAvailability(available, total)}
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
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatConnectorAvailability(
                          evse.connectorSummary.available,
                          evse.connectorSummary.total,
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <OperationalStatusBadge status={evse.operationalStatus} />
                      <RequiresAttentionIndicator
                        reasons={evse.attentionReasons}
                      />
                    </div>
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
