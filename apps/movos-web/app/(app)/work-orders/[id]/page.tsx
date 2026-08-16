'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';

import type {
  ApiAssignableTechnician,
  ApiChargingStation,
  ApiWorkOrder,
  ApiWorkOrderAttachment,
  ApiWorkOrderEvent,
  WorkOrderTransition,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/movos/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiChargingStationStatusBadge,
  ApiConnectivityStatusBadge,
} from '@/components/movos/api-charging-status-badges';
import {
  WorkOrderStatusBadge,
  WorkOrderPriorityBadge,
  WorkOrderSourceLabel,
} from '@/components/work-orders/work-order-badges';
import {
  WORK_ORDER_EVENT_LABEL,
  WorkOrderEventTimeline,
} from '@/components/work-orders/work-order-event-timeline';
import { WorkOrderTimelineSummary } from '@/components/work-orders/work-order-timeline-summary';
import { WorkOrderVisitLocation } from '@/components/work-orders/work-order-visit-location';
import { WorkOrderAttachmentGallery } from '@/components/work-orders/work-order-attachment-gallery';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';
import { formatDateTime, formatWorkOrderDateTime } from '@/lib/format';

const RESOLUTION_SUMMARY_MIN_LENGTH = 20;

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

const STATUS_EVENT_TYPES = new Set([
  'CREATED',
  'ASSIGNED',
  'STARTED',
  'RESOLVED',
  'CANCELLED',
]);

/**
 * Work Order V1 (WO-ARGOS-035) — "What exactly is happening with this
 * problem?" Every section here (timeline, notes, status history, station
 * summary) is real data, not a placeholder — see
 * docs/operations/WORK_ORDER_UI.md for the design this implements.
 */
export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [workOrder, setWorkOrder] = React.useState<ApiWorkOrder | null>(null);
  const [events, setEvents] = React.useState<ApiWorkOrderEvent[]>([]);
  const [attachments, setAttachments] = React.useState<
    ApiWorkOrderAttachment[]
  >([]);
  const [station, setStation] = React.useState<ApiChargingStation | null>(null);
  const [technicians, setTechnicians] = React.useState<
    ApiAssignableTechnician[]
  >([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = React.useState('');
  const [state, setState] = React.useState<LoadState>('loading');
  const [pending, setPending] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState('');
  const [closeMode, setCloseMode] = React.useState<'resolve' | 'cancel' | null>(
    null,
  );
  const [closeNote, setCloseNote] = React.useState('');
  const [editingSchedule, setEditingSchedule] = React.useState(false);
  const [scheduleDraft, setScheduleDraft] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      const wo = await apiClient.get<ApiWorkOrder>(`/work-orders/${id}`);
      setWorkOrder(wo);
      const [evts, atts, stationDetail, eligibleTechnicians] =
        await Promise.all([
          apiClient.get<ApiWorkOrderEvent[]>(`/work-orders/${id}/events`),
          apiClient
            .get<ApiWorkOrderAttachment[]>(`/work-orders/${id}/attachments`)
            .catch(() => []),
          apiClient
            .get<ApiChargingStation>(`/charging-stations/${wo.stationId}`)
            .catch(() => null),
          apiClient
            .get<ApiAssignableTechnician[]>(
              '/work-orders/assignable-technicians',
            )
            .catch(() => []),
        ]);
      setEvents(evts);
      setAttachments(atts);
      setStation(stationDetail);
      setTechnicians(eligibleTechnicians);
      setState('ready');
    } catch (err) {
      setState(
        err instanceof ApiError && err.status === 404 ? 'notfound' : 'error',
      );
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function saveSchedule(): Promise<void> {
    setPending(true);
    try {
      await apiClient.patch(`/work-orders/${id}/schedule`, {
        scheduledAt: scheduleDraft
          ? new Date(scheduleDraft).toISOString()
          : null,
      });
      setEditingSchedule(false);
      await load();
    } finally {
      setPending(false);
    }
  }

  async function send(
    transition: WorkOrderTransition,
    extra: { assignedMemberId?: string; comment?: string } = {},
  ): Promise<void> {
    setPending(true);
    try {
      await apiClient.patch(`/work-orders/${id}`, { transition, ...extra });
      setCommentDraft('');
      setCloseMode(null);
      setCloseNote('');
      setSelectedTechnicianId('');
      await load();
    } finally {
      setPending(false);
    }
  }

  if (state === 'loading') {
    return (
      <PageContainer>
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </PageContainer>
    );
  }

  if (state === 'notfound' || !workOrder) {
    return (
      <PageContainer>
        <EmptyState
          title="Orden de trabajo no encontrada"
          description="Puede que haya sido eliminada o que no tengas acceso."
        />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <EmptyState title="No se pudo cargar la orden de trabajo." />
      </PageContainer>
    );
  }

  const isTerminal =
    workOrder.status === 'RESOLVED' || workOrder.status === 'CANCELLED';
  const canAssign =
    workOrder.status === 'OPEN' || workOrder.status === 'ASSIGNED';
  const canStart = workOrder.status === 'ASSIGNED';
  const canResolve = workOrder.status === 'IN_PROGRESS';
  const canCancel = !isTerminal;
  const statusEvents = events.filter((e) => STATUS_EVENT_TYPES.has(e.type));

  return (
    <PageContainer>
      <Link
        href="/work-orders"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {workOrder.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {workOrder.stationName} · Origen:{' '}
            <WorkOrderSourceLabel source={workOrder.source} />
          </p>
        </div>
        <div className="flex gap-2">
          <WorkOrderPriorityBadge priority={workOrder.priority} />
          <WorkOrderStatusBadge status={workOrder.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del incidente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{workOrder.description}</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Creada</dt>
                <dd>{formatDateTime(workOrder.createdAt)}</dd>
              </div>
              {workOrder.assignedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Asignada</dt>
                  <dd>{formatDateTime(workOrder.assignedAt)}</dd>
                </div>
              )}
              {workOrder.resolvedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Resuelta</dt>
                  <dd>{formatDateTime(workOrder.resolvedAt)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dónde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <WorkOrderVisitLocation location={workOrder.visitLocation} />
            {station && (
              <>
                <div className="flex flex-wrap gap-2">
                  <ApiConnectivityStatusBadge
                    status={station.connectivityStatus}
                  />
                  <ApiChargingStationStatusBadge status={station.status} />
                </div>
                <Link
                  href={`/sites/${station.siteId}/charging-stations/${station.id}`}
                  className="text-movos-blue text-xs hover:underline"
                >
                  Ver estación →
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Visita programada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!editingSchedule && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                {workOrder.scheduledAt
                  ? formatWorkOrderDateTime(workOrder.scheduledAt)
                  : 'Sin programar'}
              </p>
              {!isTerminal && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setScheduleDraft(
                      workOrder.scheduledAt
                        ? workOrder.scheduledAt.slice(0, 16)
                        : '',
                    );
                    setEditingSchedule(true);
                  }}
                >
                  {workOrder.scheduledAt ? 'Editar' : 'Programar visita'}
                </Button>
              )}
            </div>
          )}
          {editingSchedule && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduleDraft}
                onChange={(e) => setScheduleDraft(e.target.value)}
                className="border-border bg-accent/40 h-8 rounded-md border px-2 text-xs"
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void saveSchedule()}
              >
                Guardar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditingSchedule(false)}
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Técnico asignado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{workOrder.assignedMemberName ?? 'Sin asignar'}</p>

          {!isTerminal && canAssign && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                disabled={pending}
                className="border-border bg-background h-8 rounded-md border px-2 text-xs"
              >
                <option value="">
                  {technicians.length === 0
                    ? 'Sin técnicos disponibles'
                    : 'Seleccionar técnico…'}
                </option>
                {technicians.map((tech) => (
                  <option key={tech.userId} value={tech.userId}>
                    {tech.displayName}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={pending || !selectedTechnicianId}
                onClick={() =>
                  void send('assign', {
                    assignedMemberId: selectedTechnicianId,
                  })
                }
              >
                Asignar técnico
              </Button>
            </div>
          )}

          {!isTerminal && (
            <div className="flex flex-wrap gap-2">
              {canAssign && currentUser && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void send('assign', { assignedMemberId: currentUser.id })
                  }
                >
                  Asignarme
                </Button>
              )}
              {canStart && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void send('start')}
                >
                  Iniciar trabajo
                </Button>
              )}
              {canResolve && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => setCloseMode('resolve')}
                >
                  Resolver
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setCloseMode('cancel')}
                >
                  Cancelar
                </Button>
              )}
            </div>
          )}

          {closeMode && (
            <div className="space-y-1.5">
              {closeMode === 'resolve' && (
                <div>
                  <label className="text-xs font-medium">
                    Resumen de resolución
                  </label>
                  <p className="text-muted-foreground text-[11px]">
                    Describe brevemente qué se encontró, qué se hizo y el
                    resultado final.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder={
                    closeMode === 'resolve'
                      ? 'Resumen de resolución…'
                      : 'Motivo de cancelación…'
                  }
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  size="sm"
                  disabled={
                    pending ||
                    (closeMode === 'resolve'
                      ? closeNote.trim().length < RESOLUTION_SUMMARY_MIN_LENGTH
                      : closeNote.trim().length === 0)
                  }
                  onClick={() => void send(closeMode, { comment: closeNote })}
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setCloseMode(null)}
                >
                  Cancelar
                </Button>
              </div>
              {closeMode === 'resolve' &&
                closeNote.trim().length > 0 &&
                closeNote.trim().length < RESOLUTION_SUMMARY_MIN_LENGTH && (
                  <p className="text-[11px] text-amber-500">
                    Cuéntanos un poco más — mínimo{' '}
                    {RESOLUTION_SUMMARY_MIN_LENGTH} caracteres.
                  </p>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {workOrder.status === 'RESOLVED' && workOrder.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Resumen de resolución</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="border-border bg-accent/20 rounded-lg border px-3 py-2 text-sm">
              {workOrder.notes}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Notas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {workOrder.status !== 'RESOLVED' && workOrder.notes ? (
            <p className="border-border rounded-lg border px-3 py-2">
              {workOrder.notes}
            </p>
          ) : workOrder.status !== 'RESOLVED' ? (
            <p className="text-muted-foreground">Sin notas todavía.</p>
          ) : null}
          {!isTerminal && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Agregar un comentario…"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                className="h-8 flex-1 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pending || commentDraft.trim().length === 0}
                onClick={() => void send('comment', { comment: commentDraft })}
              >
                Comentar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Evidencia</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkOrderAttachmentGallery
            workOrderId={id}
            surface="work-orders"
            attachments={attachments}
          />
        </CardContent>
      </Card>

      <WorkOrderTimelineSummary workOrder={workOrder} events={events} />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkOrderEventTimeline events={events} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Historial de estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {statusEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between text-sm"
            >
              <span>{WORK_ORDER_EVENT_LABEL[event.type] ?? event.type}</span>
              <span className="text-muted-foreground text-xs">
                {formatDateTime(event.createdAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
