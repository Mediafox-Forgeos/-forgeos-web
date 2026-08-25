'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiOrganizationMember } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { addMember } from '@/lib/memberships-api';
import { assignableRoles, roleLabel } from './member-role-vocabulary';

interface AddMemberModalProps {
  open: boolean;
  actorRole: string;
  onClose: () => void;
  onAdded: (member: ApiOrganizationMember) => void;
}

/**
 * WO-ARGOS-089 §10 — only adds an EXISTING MOVOS user by email. If no
 * account exists for that email, the backend's 404 message says so
 * explicitly ("contacta al equipo de MOVOS") — this modal never invents a
 * password or silently creates an account; see MembershipsService.create's
 * doc comment for why that's a separate, not-yet-authorized decision.
 */
export function AddMemberModal({
  open,
  actorRole,
  onClose,
  onAdded,
}: AddMemberModalProps) {
  const roles = assignableRoles(actorRole);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState(roles[0] ?? 'VIEWER');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole(roles[0] ?? 'VIEWER');
    setError(null);
    setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open, not on every roles-array identity change
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('El correo electrónico es requerido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addMember(email.trim(), role);
      onAdded(created);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible agregar el usuario. Intenta nuevamente.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
    >
      <div className="border-border bg-background w-full max-w-md rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-member-title" className="text-lg font-semibold">
            Agregar usuario
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

        <p className="text-muted-foreground mb-4 text-sm">
          El usuario debe tener ya una cuenta MOVOS. Se le dará acceso a esta
          organización con el rol seleccionado.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="member-email" className="text-sm font-medium">
              Correo electrónico
            </label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@kylumenergy.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="member-role" className="text-sm font-medium">
              Rol
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSubmitting}
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

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
              {isSubmitting ? 'Agregando…' : 'Agregar usuario'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
