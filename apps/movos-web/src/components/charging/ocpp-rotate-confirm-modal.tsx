'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import {
  rotateOcppCredentials,
  type OcppProvisioningResult,
} from '@/lib/charging-api';

type Phase = 'confirm' | 'submitting' | 'error';

/**
 * Strong, explicit confirmation before rotating a station's OCPP secret —
 * never fires on open. Errors (403/404/409/5xx) surface the backend's own
 * message rather than a generic one, and never trigger a fallback mutation
 * (e.g. auto-provisioning) on their own.
 */
export function OcppRotateConfirmModal({
  open,
  chargingStationId,
  stationName,
  stationCode,
  onClose,
  onRotated,
}: {
  open: boolean;
  chargingStationId: string;
  stationName: string;
  stationCode: string | null;
  onClose: () => void;
  onRotated: (result: OcppProvisioningResult) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>('confirm');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPhase('confirm');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleConfirm(): Promise<void> {
    if (phase === 'submitting') return;
    setPhase('submitting');
    setError(null);
    try {
      const result = await rotateOcppCredentials(chargingStationId);
      onRotated(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible rotar las credenciales OCPP. Intenta nuevamente.',
      );
      setPhase('error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocpp-rotate-title"
    >
      <div className="border-border bg-background w-full max-w-md rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="ocpp-rotate-title" className="text-lg font-semibold">
            Rotar credenciales OCPP
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
          <div className="flex justify-between text-sm">
            <dt className="text-muted-foreground">Estación</dt>
            <dd className="font-medium">{stationName}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-muted-foreground">Código</dt>
            <dd className="font-medium">{stationCode ?? 'Sin código'}</dd>
          </div>
        </dl>

        {phase !== 'error' && (
          <div className="space-y-4">
            <p className="text-sm">
              Se generará un nuevo secreto OCPP para esta estación. El secreto
              anterior dejará de ser válido y cualquier cargador o Digital Twin
              que lo utilice deberá configurarse con las nuevas credenciales.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={phase === 'submitting'}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleConfirm()}
                disabled={phase === 'submitting'}
              >
                {phase === 'submitting' ? 'Rotando…' : 'Rotar credenciales'}
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
