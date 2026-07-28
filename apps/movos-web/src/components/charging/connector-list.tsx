'use client';

import { Cable, Plus } from 'lucide-react';
import * as React from 'react';
import type { ApiConnector } from '@mediafox/shared-types';

import { EmptyState } from '@/components/movos/empty-state';
import { ApiConnectorStatusBadge } from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { listConnectorsByEvse } from '@/lib/charging-api';
import { ConnectorFormModal } from './connector-form-modal';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

interface ConnectorListProps {
  evseId: string;
  canManage: boolean;
}

export function ConnectorList({ evseId, canManage }: ConnectorListProps) {
  const [connectors, setConnectors] = React.useState<ApiConnector[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApiConnector | undefined>();

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const data = await listConnectorsByEvse(evseId);
      setConnectors(data);
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

  function handleSaved(connector: ApiConnector): void {
    setConnectors((prev) => {
      const exists = prev.some((c) => c.id === connector.id);
      return exists
        ? prev.map((c) => (c.id === connector.id ? connector : c))
        : [connector, ...prev];
    });
  }

  function openCreate(): void {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(connector: ApiConnector): void {
    setEditing(connector);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Conectores</h3>
          {state === 'ready' && (
            <p
              className="text-muted-foreground mt-1 text-xs"
              data-testid="connector-summary"
            >
              {connectors.length}{' '}
              {connectors.length === 1 ? 'conector' : 'conectores'}
            </p>
          )}
        </div>
        {canManage && state === 'ready' && connectors.length > 0 && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Crear conector
          </Button>
        )}
      </div>

      {state === 'loading' && <ConnectorListSkeleton />}

      {state === 'notfound' && (
        <EmptyState title="Este EVSE no está disponible." />
      )}

      {state === 'error' && (
        <EmptyState
          icon={Cable}
          title="No fue posible cargar los conectores."
          description="Verifica tu conexión con MOVOS e intenta nuevamente."
          action={
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      )}

      {state === 'ready' && connectors.length === 0 && (
        <EmptyState
          icon={Cable}
          title="No hay conectores registrados en este EVSE."
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden="true" />
                Crear conector
              </Button>
            ) : undefined
          }
        />
      )}

      {state === 'ready' && connectors.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {connectors.map((connector) => (
            <Card
              key={connector.id}
              role={canManage ? 'button' : undefined}
              tabIndex={canManage ? 0 : undefined}
              onClick={canManage ? () => openEdit(connector) : undefined}
              className={
                canManage
                  ? 'hover:border-movos-blue/50 cursor-pointer transition-colors'
                  : undefined
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {connector.type}
                      {connector.externalId ? ` · ${connector.externalId}` : ''}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {connector.maxPowerKw != null
                        ? `${connector.maxPowerKw} kW`
                        : 'Potencia sin especificar'}
                    </p>
                  </div>
                  <ApiConnectorStatusBadge status={connector.status} />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <ConnectorFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        connector={editing}
        evseId={evseId}
        onSaved={handleSaved}
      />
    </div>
  );
}

function ConnectorListSkeleton() {
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
