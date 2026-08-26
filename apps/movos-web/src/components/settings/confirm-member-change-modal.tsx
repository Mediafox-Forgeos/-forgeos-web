'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type { ApiOrganizationMember } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { updateMember } from '@/lib/memberships-api';
import { roleLabel, statusLabel } from './member-role-vocabulary';

export interface PendingMemberChange {
  member: ApiOrganizationMember;
  role?: string;
  status?: string;
}

/**
 * WO-ARGOS-089 §11 — explicit confirmation for every role/status change,
 * not just the "dangerous" ones (OWNER/ADMIN demotion, deactivation) — the
 * smallest correct rule here is "always confirm," rather than maintaining a
 * second, UI-side notion of which changes are dangerous that could drift
 * from the backend's own (the real) boundary. If the final-owner invariant
 * or an RBAC boundary applies, the backend's own message is shown verbatim
 * — never replaced with a generic one.
 */
export function ConfirmMemberChangeModal({
  pending,
  onClose,
  onChanged,
}: {
  pending: PendingMemberChange | null;
  onClose: () => void;
  onChanged: (member: ApiOrganizationMember) => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSubmitting(false);
    setError(null);
  }, [pending]);

  if (!pending) return null;
  const { member, role, status } = pending;

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateMember(member.id, { role, status });
      onChanged(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible aplicar el cambio. Intenta nuevamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-member-change-title"
    >
      <div className="border-border bg-background w-full max-w-md rounded-xl border p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="confirm-member-change-title"
            className="text-lg font-semibold"
          >
            {status !== undefined
              ? 'Confirmar cambio de acceso'
              : 'Confirmar cambio de rol'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={submitting}
          >
            <X className="size-5" />
          </Button>
        </div>

        <dl className="mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <dt className="text-muted-foreground">Usuario</dt>
            <dd className="font-medium">{member.displayName}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="font-medium">{member.email}</dd>
          </div>
          {role !== undefined && (
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Nuevo rol</dt>
              <dd className="font-medium">{roleLabel(role)}</dd>
            </div>
          )}
          {status !== undefined && (
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Nuevo estado</dt>
              <dd className="font-medium">{statusLabel(status)}</dd>
            </div>
          )}
        </dl>

        <p className="text-sm">
          {status === 'SUSPENDED'
            ? 'Este usuario perderá acceso a la organización de inmediato.'
            : status === 'ACTIVE'
              ? 'Este usuario recuperará acceso a la organización de inmediato.'
              : 'Este cambio de rol aplica de inmediato en el próximo request del usuario.'}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting}>
            {submitting ? 'Aplicando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
