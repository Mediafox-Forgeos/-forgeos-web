'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiEvse } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { createEvse, updateEvse } from '@/lib/charging-api';

interface EvseFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Present in edit mode; absent in create mode. */
  evse?: ApiEvse;
  /** Required in create mode — the ChargingStation this EVSE belongs to. */
  chargingStationId?: string;
  onSaved: (evse: ApiEvse) => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'UNAVAILABLE', label: 'No disponible' },
  { value: 'OFFLINE', label: 'Fuera de línea' },
];

const CURRENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Sin especificar' },
  { value: 'AC', label: 'AC' },
  { value: 'DC', label: 'DC' },
];

export function EvseFormModal({
  open,
  onClose,
  evse,
  chargingStationId,
  onSaved,
}: EvseFormModalProps) {
  const isEdit = evse !== undefined;
  const [externalId, setExternalId] = React.useState('');
  const [name, setName] = React.useState('');
  const [status, setStatus] = React.useState('UNAVAILABLE');
  const [maxPowerKw, setMaxPowerKw] = React.useState('');
  const [currentType, setCurrentType] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setExternalId(evse?.externalId ?? '');
    setName(evse?.name ?? '');
    setStatus(evse?.status ?? 'UNAVAILABLE');
    setMaxPowerKw(evse?.maxPowerKw != null ? String(evse.maxPowerKw) : '');
    setCurrentType(evse?.currentType ?? '');
    setError(null);
    setIsSubmitting(false);
  }, [open, evse]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {
      externalId: externalId.trim() || undefined,
      name: name.trim() || undefined,
      status,
      maxPowerKw: maxPowerKw.trim() ? Number(maxPowerKw) : undefined,
      currentType: currentType || undefined,
    };

    setIsSubmitting(true);
    try {
      const saved =
        isEdit && evse
          ? await updateEvse(evse.id, payload)
          : await createEvse(chargingStationId as string, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible guardar el EVSE. Intenta nuevamente.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evse-form-title"
    >
      <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="evse-form-title" className="text-lg font-semibold">
            {isEdit ? 'Editar EVSE' : 'Crear EVSE'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isSubmitting}
          >
            <X className="size-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Nombre" htmlFor="evse-name">
            <Input
              id="evse-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Identificador de protocolo" htmlFor="evse-external-id">
            <Input
              id="evse-external-id"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="p. ej. el evseId de OCPP"
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Potencia máxima (kW)" htmlFor="evse-power">
              <Input
                id="evse-power"
                type="number"
                min={0}
                max={1000}
                value={maxPowerKw}
                onChange={(e) => setMaxPowerKw(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Tipo de corriente" htmlFor="evse-current-type">
              <select
                id="evse-current-type"
                value={currentType}
                onChange={(e) => setCurrentType(e.target.value)}
                disabled={isSubmitting}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {CURRENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Estado" htmlFor="evse-status">
            <select
              id="evse-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isSubmitting}
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Solo Disponible / No disponible / Fuera de línea son escribibles
              hoy — los demás estados operativos llegan con la integración OCPP.
            </p>
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear EVSE'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
