'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';

import type {
  ApiChargingStation,
  ApiWorkOrder,
  ApiWorkOrderAttachment,
  ApiWorkOrderEvent,
  ChecklistEventType,
  MyWorkTransition,
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
} from '@/components/work-orders/work-order-badges';
import { WorkOrderEventTimeline } from '@/components/work-orders/work-order-event-timeline';
import { WorkOrderTimelineSummary } from '@/components/work-orders/work-order-timeline-summary';
import { WorkOrderVisitLocation } from '@/components/work-orders/work-order-visit-location';
import { WorkOrderAttachmentGallery } from '@/components/work-orders/work-order-attachment-gallery';
import { WorkOrderEvidenceCapture } from '@/components/work-orders/work-order-evidence-capture';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatRelative, formatWorkOrderDateTime } from '@/lib/format';

const RESOLUTION_SUMMARY_MIN_LENGTH = 20;

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

const CHECKLIST_STAGES: { type: ChecklistEventType; label: string }[] = [
  { type: 'ARRIVAL_CONFIRMED', label: '1. Confirmar llegada' },
  { type: 'DIAGNOSIS_RECORDED', label: '2. Diagnóstico' },
  { type: 'INTERVENTION_RECORDED', label: '3. Intervención' },
  { type: 'VALIDATION_RECORDED', label: '4. Validación' },
];

/**
 * Technician Identity & My Work (WO-ARGOS-037), Screen 2 — "What exactly
 * is happening with this problem, and what do I do about it?" Same
 * WorkOrder/WorkOrderEvent data /work-orders/[id] renders, self-scoped
 * through MyWorkController, with a narrower action set (no assign, no
 * cancel) and the field checklist
 * (docs/operations/WORK_ORDER_CHECKLISTS.md) added on top.
 */
export default function MyWorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workOrder, setWorkOrder] = React.useState<ApiWorkOrder | null>(null);
  const [events, setEvents] = React.useState<ApiWorkOrderEvent[]>([]);
  const [attachments, setAttachments] = React.useState<
    ApiWorkOrderAttachment[]
  >([]);
  const [station, setStation] = React.useState<ApiChargingStation | null>(null);
  const [state, setState] = React.useState<LoadState>('loading');
  const [pending, setPending] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState('');
  const [resolving, setResolving] = React.useState(false);
  const [resolveNote, setResolveNote] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      const wo = await apiClient.get<ApiWorkOrder>(`/my-work/${id}`);
      setWorkOrder(wo);
      const [evts, atts, stationDetail] = await Promise.all([
        apiClient.get<ApiWorkOrderEvent[]>(`/my-work/${id}/events`),
        apiClient
          .get<ApiWorkOrderAttachment[]>(`/my-work/${id}/attachments`)
          .catch(() => []),
        apiClient
          .get<ApiChargingStation>(`/charging-stations/${wo.stationId}`)
          .catch(() => null),
      ]);
      setEvents(evts);
      setAttachments(atts);
      setStation(stationDetail);
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

  async function transition(
    action: MyWorkTransition,
    comment?: string,
  ): Promise<void> {
    setPending(true);
    try {
      await apiClient.patch(`/my-work/${id}`, { transition: action, comment });
      setCommentDraft('');
      setResolving(false);
      setResolveNote('');
      await load();
    } finally {
      setPending(false);
    }
  }

  const completedStages = new Set(
    events
      .map((e) => e.type)
      .filter((t): t is ChecklistEventType =>
        CHECKLIST_STAGES.some((s) => s.type === t),
      ),
  );

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
          description="Puede que no esté asignada a ti o que haya sido eliminada."
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
  const canStart = workOrder.status === 'ASSIGNED';
  const canResolve = workOrder.status === 'IN_PROGRESS';
  const canUseChecklist = !isTerminal;

  return (
    <PageContainer>
      <Link
        href="/my-work"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a Mi trabajo
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {workOrder.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {workOrder.stationName}
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
            <CardTitle>Qué pasó</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{workOrder.description}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Creada {formatRelative(workOrder.createdAt)}
              {workOrder.assignedAt &&
                ` · Asignada ${formatRelative(workOrder.assignedAt)}`}
            </p>
            {workOrder.scheduledAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                Visita programada:{' '}
                {formatWorkOrderDateTime(workOrder.scheduledAt)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dónde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <WorkOrderVisitLocation location={workOrder.visitLocation} />
            {station && (
              <div className="flex flex-wrap gap-2">
                <ApiConnectivityStatusBadge
                  status={station.connectivityStatus}
                />
                <ApiChargingStationStatusBadge status={station.status} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Ejecución</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!isTerminal && (
            <div className="flex flex-wrap gap-2">
              {canStart && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => void transition('start')}
                >
                  Iniciar trabajo
                </Button>
              )}
              {canResolve && !resolving && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => setResolving(true)}
                >
                  Resolver
                </Button>
              )}
            </div>
          )}

          {resolving && (
            <div className="space-y-1.5">
              <div>
                <label className="text-xs font-medium">
                  Resumen de resolución
                </label>
                <p className="text-muted-foreground text-[11px]">
                  Describe brevemente qué se encontró, qué se hizo y el
                  resultado final.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Resumen de resolución…"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  size="sm"
                  disabled={
                    pending ||
                    resolveNote.trim().length < RESOLUTION_SUMMARY_MIN_LENGTH
                  }
                  onClick={() => void transition('resolve', resolveNote)}
                >
                  Confirmar resolución
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setResolving(false)}
                >
                  Cancelar
                </Button>
              </div>
              {resolveNote.trim().length > 0 &&
                resolveNote.trim().length < RESOLUTION_SUMMARY_MIN_LENGTH && (
                  <p className="text-[11px] text-amber-500">
                    Cuéntanos un poco más — mínimo{' '}
                    {RESOLUTION_SUMMARY_MIN_LENGTH} caracteres.
                  </p>
                )}
            </div>
          )}

          {isTerminal && (
            <p className="text-muted-foreground text-xs">
              Esta orden de trabajo ya está cerrada.
            </p>
          )}
        </CardContent>
      </Card>

      {canUseChecklist && (
        <ChecklistCard
          workOrderId={id}
          completedStages={completedStages}
          events={events}
          onRecorded={load}
        />
      )}

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
          <CardTitle>Evidencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isTerminal && (
            <WorkOrderEvidenceCapture workOrderId={id} onUploaded={load} />
          )}
          <WorkOrderAttachmentGallery
            workOrderId={id}
            surface="my-work"
            attachments={attachments}
          />
        </CardContent>
      </Card>

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
                onClick={() => void transition('comment', commentDraft)}
              >
                Comentar
              </Button>
            </div>
          )}
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
    </PageContainer>
  );
}

function ChecklistCard({
  workOrderId,
  completedStages,
  events,
  onRecorded,
}: {
  workOrderId: string;
  completedStages: Set<ChecklistEventType>;
  events: ApiWorkOrderEvent[];
  onRecorded: () => Promise<void>;
}) {
  const [activeStage, setActiveStage] =
    React.useState<ChecklistEventType | null>(null);
  const [text, setText] = React.useState('');
  const [pending, setPending] = React.useState(false);

  async function record(type: ChecklistEventType): Promise<void> {
    setPending(true);
    try {
      const body: Record<string, unknown> = { type };
      if (type === 'DIAGNOSIS_RECORDED') body.finding = text;
      if (type === 'INTERVENTION_RECORDED') body.description = text;
      if (type === 'VALIDATION_RECORDED') body.outcomeNote = text;
      if (type === 'ARRIVAL_CONFIRMED' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              body.latitude = pos.coords.latitude;
              body.longitude = pos.coords.longitude;
              body.accuracy = pos.coords.accuracy;
              resolve();
            },
            () => resolve(), // denied/unavailable — proceed without coordinates
            { timeout: 3000 },
          );
        });
      }
      await apiClient.post(`/my-work/${workOrderId}/checklist-events`, body);
      setActiveStage(null);
      setText('');
      await onRecorded();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Checklist de campo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground text-xs">
          Opcional — evidencia de cada etapa, incluida foto o video.
        </p>
        {CHECKLIST_STAGES.map((stage) => {
          const done = completedStages.has(stage.type);
          const stageEvent = events.find((e) => e.type === stage.type);
          return (
            <div
              key={stage.type}
              className="border-border rounded-lg border px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={done ? 'text-muted-foreground line-through' : ''}
                >
                  {stage.label}
                </span>
                {!done && activeStage !== stage.type && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setActiveStage(stage.type);
                      setText('');
                      if (stage.type === 'ARRIVAL_CONFIRMED')
                        void record(stage.type);
                    }}
                  >
                    Registrar
                  </Button>
                )}
                {done && (
                  <span className="text-movos-blue text-xs">Completado</span>
                )}
              </div>
              {done && stageEvent && (
                <div className="mt-2">
                  <WorkOrderEvidenceCapture
                    workOrderId={workOrderId}
                    eventId={stageEvent.id}
                    onUploaded={onRecorded}
                  />
                </div>
              )}
              {activeStage === stage.type &&
                stage.type !== 'ARRIVAL_CONFIRMED' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      placeholder={
                        stage.type === 'DIAGNOSIS_RECORDED'
                          ? 'Qué encontraste…'
                          : stage.type === 'INTERVENTION_RECORDED'
                            ? 'Qué hiciste…'
                            : 'Resultado de la validación…'
                      }
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="h-8 flex-1 text-xs"
                    />
                    <Button
                      size="sm"
                      disabled={pending || text.trim().length === 0}
                      onClick={() => void record(stage.type)}
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setActiveStage(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
