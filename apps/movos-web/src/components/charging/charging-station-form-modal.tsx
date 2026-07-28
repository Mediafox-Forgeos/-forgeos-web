'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiChargingStation } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import {
  createChargingStation,
  updateChargingStation,
} from '@/lib/charging-api';

interface ChargingStationFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Present in edit mode; absent in create mode. */
  station?: ApiChargingStation;
  /** Required in create mode — the Site this station belongs to. */
  siteId?: string;
  onSaved: (station: ApiChargingStation) => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

export function ChargingStationFormModal({
  open,
  onClose,
  station,
  siteId,
  onSaved,
}: ChargingStationFormModalProps) {
  const isEdit = station !== undefined;
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [manufacturer, setManufacturer] = React.useState('');
  const [model, setModel] = React.useState('');
  const [status, setStatus] = React.useState('DRAFT');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(station?.name ?? '');
    setCode(station?.code ?? '');
    setManufacturer(station?.manufacturer ?? '');
    setModel(station?.model ?? '');
    setStatus(station?.status ?? 'DRAFT');
    setError(null);
    setIsSubmitting(false);
  }, [open, station]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es requerido.');
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      status,
    };

    setIsSubmitting(true);
    try {
      const saved =
        isEdit && station
          ? await updateChargingStation(station.id, payload)
          : await createChargingStation(siteId as string, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible guardar la estación de carga. Intenta nuevamente.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charging-station-form-title"
    >
      <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="charging-station-form-title"
            className="text-lg font-semibold"
          >
            {isEdit ? 'Editar estación de carga' : 'Crear estación de carga'}
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
          <Field label="Nombre" htmlFor="cs-name">
            <Input
              id="cs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Código" htmlFor="cs-code">
            <Input
              id="cs-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Único dentro del sitio"
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fabricante" htmlFor="cs-manufacturer">
              <Input
                id="cs-manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Modelo" htmlFor="cs-model">
              <Input
                id="cs-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field label="Estado" htmlFor="cs-status">
            <select
              id="cs-status"
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
                  : 'Crear estación'}
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
