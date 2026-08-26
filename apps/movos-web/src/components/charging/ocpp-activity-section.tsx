'use client';

import { ArrowDownLeft, ArrowUpRight, Radio } from 'lucide-react';
import * as React from 'react';
import type { ApiOcppProtocolEvent } from '@mediafox/shared-types';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/movos/empty-state';
import { ApiError } from '@/lib/api-client';
import { listOcppEvents } from '@/lib/ocpp-events-api';
import { formatTime } from '@/lib/format';

const RECENT_LIMIT = 25;

const DIRECTION_LABEL: Record<string, string> = {
  INBOUND: 'Del cargador',
  OUTBOUND: 'Al cargador',
};

const MESSAGE_TYPE_TONE: Record<string, BadgeTone> = {
  CALL: 'info',
  CALLRESULT: 'success',
  CALLERROR: 'danger',
};

const PROCESSING_STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Recibido',
  PROCESSED: 'Procesado',
  UNSUPPORTED: 'No soportado',
  REJECTED: 'Rechazado',
  FAILED: 'Falló',
};

const PROCESSING_STATUS_TONE: Record<string, BadgeTone> = {
  RECEIVED: 'neutral',
  PROCESSED: 'success',
  UNSUPPORTED: 'muted',
  REJECTED: 'warning',
  FAILED: 'danger',
};

type LoadState = 'loading' | 'ready' | 'error';

/**
 * WO-ARGOS-091 — the minimum secure, read-only OCPP support surface.
 * Displays evidence (what the persisted protocol log actually contains);
 * it does not diagnose or infer a conclusion the raw events don't support.
 * Every field shown already passed server-side redaction/bounding — this
 * component renders whatever it receives, it never needs its own secret
 * filtering.
 */
export function OcppActivitySection({ stationId }: { stationId: string }) {
  const [events, setEvents] = React.useState<ApiOcppProtocolEvent[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [state, setState] = React.useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const result = await listOcppEvents(stationId, { limit: RECENT_LIMIT });
      setEvents(result.events);
      setHasMore(result.hasMore);
      setState('ready');
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'No fue posible cargar la actividad OCPP.',
      );
      setState('error');
    }
  }, [stationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function loadMore(): Promise<void> {
    const oldest = events[events.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const result = await listOcppEvents(stationId, {
        limit: RECENT_LIMIT,
        before: oldest.receivedAt,
      });
      setEvents((prev) => [...prev, ...result.events]);
      setHasMore(result.hasMore);
    } catch {
      // A failed "load more" leaves the already-loaded rows intact — no
      // reason to blank out a working view over a follow-up page failing.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div>
          <h3 className="text-sm font-medium">Actividad OCPP</h3>
          <p className="text-muted-foreground text-xs">
            Últimos mensajes del protocolo OCPP registrados para esta estación.
          </p>
        </div>

        {state === 'loading' && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {state === 'error' && (
          <EmptyState
            icon={Radio}
            title="No fue posible cargar la actividad OCPP."
            description={errorMessage ?? undefined}
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        )}

        {state === 'ready' && events.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Sin actividad OCPP registrada para esta estación.
          </p>
        )}

        {state === 'ready' && events.length > 0 && (
          <div className="space-y-1">
            {events.map((event) => (
              <OcppEventRow
                key={event.id}
                event={event}
                expanded={expandedId === event.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === event.id ? null : event.id))
                }
              />
            ))}
            {hasMore && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OcppEventRow({
  event,
  expanded,
  onToggle,
}: {
  event: ApiOcppProtocolEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const inbound = event.direction === 'INBOUND';
  const label = event.action ?? event.messageType;

  return (
    <div className="border-border rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="hover:bg-accent/40 flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors"
      >
        <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">
          {formatTime(event.receivedAt)}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-xs"
          title={DIRECTION_LABEL[event.direction] ?? event.direction}
        >
          {inbound ? (
            <ArrowDownLeft
              className="size-3.5 text-sky-400"
              aria-hidden="true"
            />
          ) : (
            <ArrowUpRight
              className="size-3.5 text-amber-400"
              aria-hidden="true"
            />
          )}
          <span className="text-muted-foreground hidden sm:inline">
            {DIRECTION_LABEL[event.direction] ?? event.direction}
          </span>
        </span>
        <span className="flex-1 truncate font-medium">{label}</span>
        <Badge tone={MESSAGE_TYPE_TONE[event.messageType] ?? 'neutral'}>
          {event.messageType}
        </Badge>
        <Badge
          tone={PROCESSING_STATUS_TONE[event.processingStatus] ?? 'neutral'}
        >
          {PROCESSING_STATUS_LABEL[event.processingStatus] ??
            event.processingStatus}
        </Badge>
      </button>
      {expanded && (
        <div className="border-border bg-muted/30 border-t px-3 py-2">
          {event.processingError && (
            <p className="mb-2 text-xs text-amber-400">
              {event.processingError}
            </p>
          )}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
