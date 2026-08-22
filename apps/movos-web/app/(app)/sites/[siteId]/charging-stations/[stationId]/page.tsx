'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
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
import {
  getChargingStation,
  provisionOcppCredentials,
  type OcppProvisioningResult,
} from '@/lib/charging-api';
import { useAuth } from '@/context/auth-context';
import { EvseList } from '@/components/charging/evse-list';
import { ChargingStationFormModal } from '@/components/charging/charging-station-form-modal';
import { OcppCredentialResultModal } from '@/components/charging/ocpp-credential-result-modal';
import { OcppRotateConfirmModal } from '@/components/charging/ocpp-rotate-confirm-modal';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

export default function ChargingStationDetailPage() {
  const params = useParams<{ siteId: string; stationId: string }>();
  const { siteId, stationId } = params;
  const { membership } = useAuth();
  const canManage =
    membership?.role === 'OWNER' ||
    membership?.role === 'ADMIN' ||
    membership?.role === 'OPERATOR';
  // OCPP credential administration (provision/rotate) is OWNER/ADMIN only on
  // the backend (see OcppProvisioningController's @Roles) — narrower than
  // canManage above, which also includes OPERATOR. Using canManage here
  // would show an action that 403s for OPERATOR.
  const canManageOcppCredentials =
    membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const [station, setStation] = React.useState<ApiChargingStation | null>(null);
  const [site, setSite] = React.useState<ApiSite | null>(null);
  const [sessions, setSessions] = React.useState<ApiChargingSession[]>([]);
  const [workOrders, setWorkOrders] = React.useState<ApiWorkOrder[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [editOpen, setEditOpen] = React.useState(false);
  const [isProvisioning, setIsProvisioning] = React.useState(false);
  const [provisionError, setProvisionError] = React.useState<string | null>(
    null,
  );
  const [rotateOpen, setRotateOpen] = React.useState(false);
  const [credentialResult, setCredentialResult] = React.useState<{
    title: string;
    value: OcppProvisioningResult;
  } | null>(null);

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
      const result = await provisionOcppCredentials(station.id);
      setCredentialResult({
        title: 'Estación aprovisionada para OCPP',
        value: result,
      });
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
            {canManageOcppCredentials && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleProvision()}
                disabled={isProvisioning}
              >
                {isProvisioning ? 'Aprovisionando…' : 'Aprovisionar OCPP'}
              </Button>
            )}
            {canManageOcppCredentials && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotateOpen(true)}
              >
                Rotar credenciales OCPP
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

      <OcppRotateConfirmModal
        open={rotateOpen}
        chargingStationId={station.id}
        stationName={station.name}
        stationCode={station.code}
        onClose={() => setRotateOpen(false)}
        onRotated={(result) => {
          setRotateOpen(false);
          setCredentialResult({
            title: 'Credenciales OCPP rotadas',
            value: result,
          });
        }}
      />

      {credentialResult && (
        <OcppCredentialResultModal
          title={credentialResult.title}
          result={credentialResult.value}
          onClose={() => setCredentialResult(null)}
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
