'use client';

import * as React from 'react';

import type {
  ApiAction,
  ActionTransition,
  RecommendationType,
} from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';
import { formatDateTime } from '@/lib/format';

const statusLabel: Record<ApiAction['status'], string> = {
  OPEN: 'Abierta',
  ACKNOWLEDGED: 'Reconocida',
  ASSIGNED: 'Asignada',
  RESOLVED: 'Resuelta',
  DISMISSED: 'Descartada',
};

const statusTone: Record<ApiAction['status'], BadgeTone> = {
  OPEN: 'neutral',
  ACKNOWLEDGED: 'info',
  ASSIGNED: 'info',
  RESOLVED: 'success',
  DISMISSED: 'muted',
};

type TransitionExtra = {
  assignedToUserId?: string;
  notes?: string;
  snoozeMinutes?: number;
};

/**
 * Operational Execution Layer (WO-ARGOS-026) — the acknowledge/assign/
 * snooze/resolve/dismiss control for one recommendation card. Every
 * transition is enforced server-side (ActionService's state machine); this
 * component only offers the buttons the current state actually allows, but
 * a disabled button is a UX courtesy, not the real guard.
 *
 * "Asignarme" (assign to self) is this MVP's only assignment path — no
 * organization-members-list endpoint exists yet to populate a picker of
 * teammates, and building one was out of this work order's scope. The
 * backend itself is not limited to self-assignment; only this control is.
 */
export function ActionButtons({
  recommendationType,
  stationId,
  action,
  onChanged,
}: {
  recommendationType: RecommendationType;
  stationId: string;
  action: ApiAction | null | undefined;
  onChanged: () => void;
}) {
  const { currentUser } = useAuth();
  const [pending, setPending] = React.useState(false);
  const [mode, setMode] = React.useState<'idle' | 'resolve' | 'dismiss'>(
    'idle',
  );
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function send(
    transition: ActionTransition,
    extra: TransitionExtra = {},
  ): Promise<void> {
    setPending(true);
    setError(null);
    try {
      if (action) {
        await apiClient.patch(`/actions/${action.id}`, {
          transition,
          ...extra,
        });
      } else {
        await apiClient.post('/actions', {
          recommendationType,
          stationId,
          transition,
          ...extra,
        });
      }
      setMode('idle');
      setNotes('');
      onChanged();
    } catch {
      setError('No se pudo completar la acción. Intenta de nuevo.');
    } finally {
      setPending(false);
    }
  }

  const isTerminal =
    action?.status === 'RESOLVED' || action?.status === 'DISMISSED';
  const canAcknowledge = !action || action.status === 'OPEN';
  const canAssign =
    !action || action.status === 'OPEN' || action.status === 'ACKNOWLEDGED';

  return (
    <div className="border-border mt-3 border-t pt-2">
      {action && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={statusTone[action.status]}>
            {statusLabel[action.status]}
          </Badge>
          {action.assignedToUserName && (
            <span className="text-muted-foreground">
              Asignada a {action.assignedToUserName}
            </span>
          )}
          {action.snoozedUntil &&
            new Date(action.snoozedUntil) > new Date() && (
              <span className="text-muted-foreground">
                Pospuesta hasta {formatDateTime(action.snoozedUntil)}
              </span>
            )}
          {isTerminal && action.notes && (
            <span className="text-muted-foreground">— {action.notes}</span>
          )}
        </div>
      )}

      {!isTerminal && mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {canAcknowledge && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void send('acknowledge')}
            >
              Reconocer
            </Button>
          )}
          {canAssign && currentUser && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                void send('assign', { assignedToUserId: currentUser.id })
              }
            >
              Asignarme
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void send('snooze', { snoozeMinutes: 60 })}
          >
            Posponer 1 h
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setMode('resolve')}
          >
            Resolver
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setMode('dismiss')}
          >
            Descartar
          </Button>
        </div>
      )}

      {!isTerminal && mode !== 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={
              mode === 'resolve'
                ? 'Nota de resolución…'
                : 'Motivo del descarte…'
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-8 flex-1 text-xs"
          />
          <Button
            size="sm"
            disabled={pending || notes.trim().length === 0}
            onClick={() => void send(mode, { notes })}
          >
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setMode('idle');
              setNotes('');
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
