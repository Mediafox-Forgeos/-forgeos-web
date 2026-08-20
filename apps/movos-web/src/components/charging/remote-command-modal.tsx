'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiRemoteCommand } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { getRemoteCommand } from '@/lib/remote-commands-api';
import {
  isFailureState,
  isSuccessState,
  remoteCommandMessage,
  TERMINAL_REMOTE_COMMAND_STATES,
} from '@/lib/remote-command-messages';

const POLL_INTERVAL_MS = 1500;
/** A ceiling on how long this dialog keeps polling, independent of the
 * backend's own confirmation window — purely a UI safety net so a forgotten
 * open tab doesn't poll forever. The backend's RemoteCommandConfirmationService
 * is the actual authority on when a command resolves. */
const MAX_POLL_MS = 6 * 60_000;

interface RemoteCommandModalProps {
  open: boolean;
  onClose: () => void;
  commandType: 'REMOTE_START' | 'REMOTE_STOP';
  title: string;
  contextLines: Array<{ label: string; value: string }>;
  confirmQuestion: string;
  warningText: string;
  onConfirm: () => Promise<ApiRemoteCommand>;
  onSettled?: (command: ApiRemoteCommand) => void;
  confirmDisabled?: boolean;
  confirmDisabledReason?: string;
  children?: React.ReactNode;
}

type Phase = 'confirm' | 'submitting' | 'polling' | 'done' | 'error';

export function RemoteCommandModal({
  open,
  onClose,
  commandType,
  title,
  contextLines,
  confirmQuestion,
  warningText,
  onConfirm,
  onSettled,
  confirmDisabled,
  confirmDisabledReason,
  children,
}: RemoteCommandModalProps) {
  const [phase, setPhase] = React.useState<Phase>('confirm');
  const [command, setCommand] = React.useState<ApiRemoteCommand | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPhase('confirm');
      setCommand(null);
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (phase !== 'polling' || !command) return;
    const startedAt = Date.now();
    let cancelled = false;

    const interval = setInterval(() => {
      void (async () => {
        if (cancelled) return;
        if (Date.now() - startedAt > MAX_POLL_MS) {
          clearInterval(interval);
          return;
        }
        try {
          const updated = await getRemoteCommand(command.id);
          if (cancelled) return;
          setCommand(updated);
          if (TERMINAL_REMOTE_COMMAND_STATES.has(updated.state)) {
            clearInterval(interval);
            setPhase('done');
            onSettled?.(updated);
          }
        } catch {
          // A transient poll failure isn't fatal — keep trying until the
          // ceiling; the backend's own state is always the source of truth.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when polling starts for a specific command id
  }, [phase, command?.id]);

  if (!open) return null;

  async function handleConfirm(): Promise<void> {
    setPhase('submitting');
    setError(null);
    try {
      const created = await onConfirm();
      setCommand(created);
      onSettled?.(created);
      setPhase(
        TERMINAL_REMOTE_COMMAND_STATES.has(created.state) ? 'done' : 'polling',
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible enviar la solicitud. Intenta nuevamente.',
      );
      setPhase('error');
    }
  }

  const statusMessage = command
    ? remoteCommandMessage(commandType, command.state)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remote-command-title"
    >
      <div className="border-border bg-background w-full max-w-md rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="remote-command-title" className="text-lg font-semibold">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={phase === 'submitting'}
          >
            <X className="size-5" />
          </Button>
        </div>

        <dl className="mb-4 space-y-1.5">
          {contextLines.map((line) => (
            <div key={line.label} className="flex justify-between text-sm">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="font-medium">{line.value}</dd>
            </div>
          ))}
        </dl>

        {phase === 'confirm' && (
          <div className="space-y-4">
            {children}
            <p className="text-sm font-medium">{confirmQuestion}</p>
            <p className="text-muted-foreground text-xs">{warningText}</p>
            {confirmDisabled && confirmDisabledReason && (
              <p
                role="alert"
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
              >
                {confirmDisabledReason}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleConfirm()}
                disabled={confirmDisabled}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {(phase === 'submitting' ||
          phase === 'polling' ||
          phase === 'done') && (
          <div className="space-y-3">
            <p
              className={
                phase === 'done' && command && isSuccessState(command.state)
                  ? 'text-sm font-medium text-emerald-500'
                  : phase === 'done' && command && isFailureState(command.state)
                    ? 'text-sm font-medium text-amber-500'
                    : 'text-sm font-medium'
              }
              aria-live="polite"
            >
              {phase === 'submitting' ? 'Enviando solicitud…' : statusMessage}
            </p>
            {phase !== 'done' && (
              <p className="text-muted-foreground text-xs">
                Esto puede tardar unos segundos.
              </p>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant={phase === 'done' ? 'default' : 'ghost'}
                onClick={onClose}
              >
                {phase === 'done' ? 'Cerrar' : 'Cerrar (seguirá en curso)'}
              </Button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              {error}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button onClick={() => void handleConfirm()}>Reintentar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
