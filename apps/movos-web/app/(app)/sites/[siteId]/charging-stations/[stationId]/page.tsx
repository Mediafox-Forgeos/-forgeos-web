'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { X } from 'lucide-react';
import type {
  ApiChargingSession,
  ApiChargingStation,
  ApiSite,
  ApiWorkOrder,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import {
  ApiChargingSessionStatusBadge,
  ApiChargingStationStatusBadge,
  ApiConnectivityStatusBadge,
} from '@/components/movos/api-charging-status-badges';
import { WorkOrderStatusBadge } from '@/components/work-orders/work-order-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatDateTime, formatRelative } from '@/lib/format';
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
  const [sessions, setSessions] = React.useState<ApiChargingSession[]>([]);
  const [workOrders, setWorkOrders] = React.useState<ApiWorkOrder[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [editOpen, setEditOpen] = React.useState(false);
  const [isProvisioning, setIsProvisioning] = React.useState(false);
  const [provisionResult, setProvisionResult] =
    React.useState<ProvisionResult | null>(null);
  const [provisionError, setProvisionError] = React.useState<string | null>(
    null,
  );

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
      try {
        setSessions(
          await apiClient.get<ApiChargingSession[]>(
            `/sessions?chargingStationId=${encodeURIComponent(stationId)}`,
          ),
        );
      } catch {
        // Optional context only — the station itself already loaded.
      }
      try {
        // WO-ARGOS-057 — GET /work-orders has no stationId filter (only
        // status/priority/assignedMemberId/unassigned/scheduledFrom/
        // scheduledTo — see ListWorkOrdersQueryDto), so this reuses the
        // existing capped (take: 100) list and narrows client-side rather
        // than adding a new backend filter for one drill-down link.
        const allWorkOrders =
          await apiClient.get<ApiWorkOrder[]>('/work-orders');
        setWorkOrders(allWorkOrders.filter((wo) => wo.stationId === stationId));
      } catch {
        // Optional context only — the station itself already loaded.
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

  async function handleProvision(): Promise<void> {
    if (!station) return;
    setIsProvisioning(true);
    setProvisionError(null);
    try {
      const result = await apiClient.post<ProvisionResult>(
        `/charging-stations/${station.id}/ocpp-provisioning`,
      );
      setProvisionResult(result);
    } catch (err) {
      setProvisionError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible aprovisionar OCPP. Intenta nuevamente.',
      );
    } finally {
      setIsProvisioning(false);
    }
  }

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
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleProvision()}
                disabled={isProvisioning}
              >
                {isProvisioning ? 'Aprovisionando…' : 'Aprovisionar OCPP'}
              </Button>
            )}
          </div>
        }
      />

      {provisionError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {provisionError}
        </p>
      )}

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

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Sesiones{sessions.length > 0 ? ` (${sessions.length})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Sin sesiones registradas para esta estación.
              </p>
            )}
            {sessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="border-border hover:bg-accent/40 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <div>
                  <p className="font-medium">
                    {(session.energyWh / 1000).toFixed(1)} kWh · iniciada{' '}
                    {formatRelative(session.startedAt)}
                  </p>
                </div>
                <ApiChargingSessionStatusBadge status={session.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Órdenes de trabajo
              {workOrders.length > 0 ? ` (${workOrders.length})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workOrders.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Sin órdenes de trabajo para esta estación.
              </p>
            )}
            {workOrders.slice(0, 5).map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="border-border hover:bg-accent/40 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <p className="truncate font-medium">{wo.title}</p>
                <WorkOrderStatusBadge status={wo.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <ChargingStationFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        station={station}
        onSaved={setStation}
      />

      {provisionResult && (
        <ProvisionResultModal
          result={provisionResult}
          onClose={() => setProvisionResult(null)}
        />
      )}
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

interface ProvisionResult {
  ocppIdentity: string;
  plaintextSecret: string;
}

/**
 * The secret is only ever held here, in this component's own local state —
 * never localStorage/sessionStorage/global state — matching the backend's
 * own guarantee that it's returned exactly once and never retrievable
 * again after this response.
 */
function ProvisionResultModal({
  result,
  onClose,
}: {
  result: ProvisionResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState<'identity' | 'secret' | null>(
    null,
  );

  async function copy(
    value: string,
    which: 'identity' | 'secret',
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the value is still
      // shown on screen for manual copy, so this is not fatal.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provision-result-title"
    >
      <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="provision-result-title" className="text-lg font-semibold">
            Estación aprovisionada para OCPP
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </Button>
        </div>

        <p
          role="alert"
          className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500"
        >
          El secreto solo se muestra esta vez. Cópialo ahora — MOVOS no lo
          volverá a mostrar.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Identidad OCPP</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 text-sm">
                {result.ocppIdentity}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(result.ocppIdentity, 'identity')}
              >
                {copied === 'identity' ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-xs">Secreto</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 text-sm">
                {result.plaintextSecret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(result.plaintextSecret, 'secret')}
              >
                {copied === 'secret' ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            Ya copié ambos valores
          </Button>
        </div>
      </div>
    </div>
  );
}
