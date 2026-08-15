'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';

import type {
  ApiChargingStation,
  ApiWorkOrder,
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
import { apiClient, ApiError } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Creada',
  ASSIGNED: 'Asignada',
  STARTED: 'Iniciada',
  COMMENTED: 'Comentario',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
  ARRIVAL_CONFIRMED: 'Llegada confirmada',
  DIAGNOSIS_RECORDED: 'Diagnóstico registrado',
  INTERVENTION_RECORDED: 'Intervención registrada',
  VALIDATION_RECORDED: 'Validación registrada',
};

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
      const [evts, stationDetail] = await Promise.all([
        apiClient.get<ApiWorkOrderEvent[]>(`/my-work/${id}/events`),
        apiClient
          .get<ApiChargingStation>(`/charging-stations/${wo.stationId}`)
          .catch(() => null),
      ]);
      setEvents(evts);
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dónde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {station ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <ApiConnectivityStatusBadge
                    status={station.connectivityStatus}
                  />
                  <ApiChargingStationStatusBadge status={station.status} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {station.manufacturer ?? 'Fabricante desconocido'}
                  {station.model ? ` · ${station.model}` : ''}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No se pudo cargar la estación.
              </p>
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
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Nota de resolución…"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                className="h-8 flex-1 text-xs"
              />
              <Button
                size="sm"
                disabled={pending || resolveNote.trim().length === 0}
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
          onRecorded={load}
        />
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Notas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {workOrder.notes ? (
            <p className="border-border rounded-lg border px-3 py-2">
              {workOrder.notes}
            </p>
          ) : (
            <p className="text-muted-foreground">Sin notas todavía.</p>
          )}
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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 && (
            <p className="text-muted-foreground text-sm">Sin actividad.</p>
          )}
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 text-sm">
              <span className="bg-movos-blue mt-1.5 size-1.5 shrink-0 rounded-full" />
              <div className="flex-1">
                <p>
                  <span className="font-medium">
                    {EVENT_LABEL[event.type] ?? event.type}
                  </span>
                  {event.actorName && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {event.actorName}
                    </span>
                  )}
                  {!event.actorName && (
                    <span className="text-muted-foreground"> · automático</span>
                  )}
                </p>
                {event.payload?.comment != null && (
                  <p className="text-muted-foreground text-xs">
                    {String(event.payload.comment)}
                  </p>
                )}
                {event.payload?.finding != null && (
                  <p className="text-muted-foreground text-xs">
                    {String(event.payload.finding)}
                  </p>
                )}
                {event.payload?.description != null && (
                  <p className="text-muted-foreground text-xs">
                    {String(event.payload.description)}
                  </p>
                )}
                {event.payload?.outcomeNote != null && (
                  <p className="text-muted-foreground text-xs">
                    {String(event.payload.outcomeNote)}
                  </p>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {formatRelative(event.createdAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function ChecklistCard({
  workOrderId,
  completedStages,
  onRecorded,
}: {
  workOrderId: string;
  completedStages: Set<ChecklistEventType>;
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
          Opcional — evidencia de cada etapa. La evidencia fotográfica no está
          disponible todavía: MOVOS no tiene almacenamiento de archivos.
        </p>
        {CHECKLIST_STAGES.map((stage) => {
          const done = completedStages.has(stage.type);
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
