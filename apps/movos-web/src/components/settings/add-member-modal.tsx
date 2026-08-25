'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import type {
  ApiMembershipInvitationCreated,
  ApiOrganizationMember,
} from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { addMember, createInvitation } from '@/lib/memberships-api';
import { assignableRoles, roleLabel } from './member-role-vocabulary';

interface AddMemberModalProps {
  open: boolean;
  actorRole: string;
  onClose: () => void;
  onAdded: (member: ApiOrganizationMember) => void;
  onInvited: (invitation: ApiMembershipInvitationCreated) => void;
}

type Phase = 'form' | 'invited';

/**
 * WO-ARGOS-089 — tries adding an EXISTING MOVOS user first (POST
 * /memberships); only on that endpoint's specific 404 ("no account exists
 * for this email") does it fall back to creating a one-time invitation
 * (POST /memberships/invitations) instead of dead-ending. Never invents a
 * password — the invited person sets their own via the public /invite/
 * <token> page. The backend independently re-verifies both branches; this
 * is orchestration, not the security boundary.
 */
export function AddMemberModal({
  open,
  actorRole,
  onClose,
  onAdded,
  onInvited,
}: AddMemberModalProps) {
  const roles = assignableRoles(actorRole);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState(roles[0] ?? 'VIEWER');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('form');
  const [invitation, setInvitation] =
    React.useState<ApiMembershipInvitationCreated | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole(roles[0] ?? 'VIEWER');
    setError(null);
    setIsSubmitting(false);
    setPhase('form');
    setInvitation(null);
    setCopied(false);
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
      return;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'No fue posible agregar el usuario. Intenta nuevamente.',
        );
        setIsSubmitting(false);
        return;
      }
      // 404 from POST /memberships means specifically "no MOVOS account for
      // this email" (MembershipsService.create's own message) — not a
      // generic failure. Fall back to inviting them.
    }

    try {
      const created = await createInvitation(email.trim(), role);
      setInvitation(created);
      onInvited(created);
      setPhase('invited');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible crear la invitación. Intenta nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyLink(): Promise<void> {
    if (!invitation) return;
    const url = `${window.location.origin}/invite/${invitation.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the URL is still
      // shown on screen for manual copy, so this is not fatal.
    }
  }

  if (phase === 'invited' && invitation) {
    const url = `${window.location.origin}/invite/${invitation.token}`;
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitation-created-title"
      >
        <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="invitation-created-title" className="text-lg font-semibold">
              Invitación creada
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </Button>
          </div>

          <dl className="mb-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Correo</dt>
              <dd className="font-medium">{invitation.email}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Rol</dt>
              <dd className="font-medium">{roleLabel(invitation.role)}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Expira</dt>
              <dd className="font-medium">
                {new Date(invitation.expiresAt).toLocaleString('es-CO')}
              </dd>
            </div>
          </dl>

          <p
            role="alert"
            className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500"
          >
            Comparte este enlace únicamente con la persona invitada. No se
            volverá a mostrar.
          </p>

          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 text-sm">
              {url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyLink()}
            >
              {copied ? 'Copiado' : 'Copiar enlace de invitación'}
            </Button>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    );
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
          Si la persona ya tiene cuenta MOVOS, se le dará acceso de inmediato.
          Si no, se creará una invitación de un solo uso para que compartas por
          fuera de MOVOS.
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
