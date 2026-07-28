'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiConnector } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { createConnector, updateConnector } from '@/lib/charging-api';

interface ConnectorFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Present in edit mode; absent in create mode. */
  connector?: ApiConnector;
  /** Required in create mode — the EVSE this connector belongs to. */
  evseId?: string;
  onSaved: (connector: ApiConnector) => void;
}

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'CCS2', label: 'CCS2' },
  { value: 'TYPE2', label: 'Type 2' },
  { value: 'CHADEMO', label: 'CHAdeMO' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'UNAVAILABLE', label: 'No disponible' },
  { value: 'OFFLINE', label: 'Fuera de línea' },
];

export function ConnectorFormModal({
  open,
  onClose,
  connector,
  evseId,
  onSaved,
}: ConnectorFormModalProps) {
  const isEdit = connector !== undefined;
  const [externalId, setExternalId] = React.useState('');
  const [type, setType] = React.useState('CCS2');
  const [status, setStatus] = React.useState('UNAVAILABLE');
  const [maxPowerKw, setMaxPowerKw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setExternalId(connector?.externalId ?? '');
    setType(connector?.type ?? 'CCS2');
    setStatus(connector?.status ?? 'UNAVAILABLE');
    setMaxPowerKw(
      connector?.maxPowerKw != null ? String(connector.maxPowerKw) : '',
    );
    setError(null);
    setIsSubmitting(false);
  }, [open, connector]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!type) {
      setError('El tipo de conector es requerido.');
      return;
    }

    const payload: Record<string, unknown> = {
      externalId: externalId.trim() || undefined,
      type,
      status,
      maxPowerKw: maxPowerKw.trim() ? Number(maxPowerKw) : undefined,
    };

    setIsSubmitting(true);
    try {
      const saved =
        isEdit && connector
          ? await updateConnector(connector.id, payload)
          : await createConnector(evseId as string, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible guardar el conector. Intenta nuevamente.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connector-form-title"
    >
      <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="connector-form-title" className="text-lg font-semibold">
            {isEdit ? 'Editar conector' : 'Crear conector'}
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
          <Field label="Tipo" htmlFor="connector-type">
            <select
              id="connector-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isSubmitting}
              required
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Identificador de protocolo"
            htmlFor="connector-external-id"
          >
            <Input
              id="connector-external-id"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="p. ej. el connectorId de OCPP"
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Potencia máxima (kW)" htmlFor="connector-power">
            <Input
              id="connector-power"
              type="number"
              min={0}
              max={1000}
              value={maxPowerKw}
              onChange={(e) => setMaxPowerKw(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Estado" htmlFor="connector-status">
            <select
              id="connector-status"
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
                  : 'Crear conector'}
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
