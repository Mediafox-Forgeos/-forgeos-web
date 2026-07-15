'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiSite } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';

interface CreateSiteModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (site: ApiSite) => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
];

export function CreateSiteModal({
  open,
  onClose,
  onCreated,
}: CreateSiteModalProps) {
  const [name, setName] = React.useState('');
  const [city, setCity] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [latitude, setLatitude] = React.useState('');
  const [longitude, setLongitude] = React.useState('');
  const [status, setStatus] = React.useState('DRAFT');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setCity('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setStatus('DRAFT');
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      city: city.trim(),
      address: address.trim(),
      status,
    };
    if (latitude.trim()) payload.latitude = Number(latitude);
    if (longitude.trim()) payload.longitude = Number(longitude);

    setIsSubmitting(true);
    try {
      const site = await apiClient.post<ApiSite>('/sites', payload);
      onCreated(site);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No fue posible crear el sitio. Intenta nuevamente.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-site-title"
    >
      <div className="border-border bg-background w-full max-w-md rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-site-title" className="text-lg font-semibold">
            Crear sitio
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
          <Field label="Nombre" htmlFor="site-name">
            <Input
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Ciudad" htmlFor="site-city">
            <Input
              id="site-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Dirección" htmlFor="site-address">
            <Input
              id="site-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud (opcional)" htmlFor="site-lat">
              <Input
                id="site-lat"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Longitud (opcional)" htmlFor="site-lng">
              <Input
                id="site-lng"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field label="Estado" htmlFor="site-status">
            <select
              id="site-status"
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
              {isSubmitting ? 'Creando…' : 'Crear sitio'}
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
