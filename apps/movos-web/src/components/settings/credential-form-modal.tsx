'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiAuthorizationCredential } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';

interface CredentialFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (credential: ApiAuthorizationCredential) => void;
}

const TYPE_OPTIONS: string[] = [
  'RFID',
  'QR',
  'APP',
  'REMOTE',
  'API',
  'FLEET',
  'PLUG_AND_CHARGE',
  'GUEST',
];

export function CredentialFormModal({
  open,
  onClose,
  onCreated,
}: CredentialFormModalProps) {
  const [type, setType] = React.useState('RFID');
  const [externalIdentifier, setExternalIdentifier] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setType('RFID');
    setExternalIdentifier('');
    setLabel('');
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!externalIdentifier.trim()) {
      setError('El identificador es requerido.');
      return;
    }

    const payload: Record<string, unknown> = {
      type,
      externalIdentifier: externalIdentifier.trim(),
      ...(label.trim() ? { metadata: { label: label.trim() } } : {}),
    };

    setIsSubmitting(true);
    try {
      const created = await apiClient.post<ApiAuthorizationCredential>(
        '/credentials',
        payload,
      );
      onCreated(created);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible crear la credencial. Intenta nuevamente.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-form-title"
    >
      <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="credential-form-title" className="text-lg font-semibold">
            Nueva credencial de autorización
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
          <Field label="Tipo" htmlFor="cred-type">
            <select
              id="cred-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isSubmitting}
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Identificador" htmlFor="cred-identifier">
            <Input
              id="cred-identifier"
              value={externalIdentifier}
              onChange={(e) => setExternalIdentifier(e.target.value)}
              placeholder="Único dentro de la organización"
              disabled={isSubmitting}
              required
            />
          </Field>

          <Field label="Etiqueta (opcional)" htmlFor="cred-label">
            <Input
              id="cred-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. para identificar el propósito de esta credencial"
              disabled={isSubmitting}
            />
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
              {isSubmitting ? 'Creando…' : 'Crear credencial'}
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
