'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Zap } from 'lucide-react';
import * as React from 'react';
import type { ApiInvitationPreview } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { acceptInvitation, previewInvitation } from '@/lib/memberships-api';
import { roleLabel } from '@/components/settings/member-role-vocabulary';
import { tenant } from '@/config/tenant';

type LoadState = 'loading' | 'ready' | 'invalid';

const GENERIC_INVALID_MESSAGE = 'Esta invitación no es válida o ya expiró.';

/**
 * WO-ARGOS-089 §8/§9/§12 — public, unauthenticated invitation acceptance.
 * Every failure state (loading the preview, submitting) is bounded — this
 * page never shows an indefinite spinner, matching the discipline the auth
 * session-stale-loop fix established. Never auto-logs in: acceptance
 * succeeds, then the person is sent to /login to authenticate normally with
 * the password they just chose.
 */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = React.useState<LoadState>('loading');
  const [preview, setPreview] = React.useState<ApiInvitationPreview | null>(
    null,
  );
  const [displayName, setDisplayName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [passwordConfirmation, setPasswordConfirmation] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await previewInvitation(token);
        if (!cancelled) {
          setPreview(data);
          setState('ready');
        }
      } catch {
        if (!cancelled) setState('invalid');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Tu nombre es requerido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptInvitation(token, {
        displayName: displayName.trim(),
        password,
        passwordConfirmation,
      });
      setAccepted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : GENERIC_INVALID_MESSAGE);
      setIsSubmitting(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-40 animate-pulse rounded" />
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="w-full max-w-sm text-center">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium">{GENERIC_INVALID_MESSAGE}</p>
            <p className="text-muted-foreground text-sm">
              Pide a quien te invitó que comparta un enlace nuevo.
            </p>
            <Link href="/login" className="text-movos-blue text-sm underline">
              Ir a iniciar sesión
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="w-full max-w-sm text-center">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium">Cuenta creada correctamente.</p>
            <p className="text-muted-foreground text-sm">
              Ya puedes iniciar sesión con tu correo y la contraseña que
              elegiste.
            </p>
            <Button asChild>
              <Link href="/login">Ir a iniciar sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="bg-movos-blue text-movos-blue-foreground grid size-11 place-items-center rounded-xl">
          <Zap className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {tenant.productName}
          </h1>
          <p className="text-muted-foreground text-sm">
            Te invitaron a {preview?.organizationName}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <dl className="mb-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Correo</dt>
              <dd className="font-medium">{preview?.email}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Rol</dt>
              <dd className="font-medium">
                {preview ? roleLabel(preview.role) : ''}
              </dd>
            </div>
          </dl>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="invite-name" className="text-sm font-medium">
                Tu nombre
              </label>
              <Input
                id="invite-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="invite-password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                disabled={isSubmitting}
              />
              <p className="text-muted-foreground text-[11px]">
                Mínimo 8 caracteres.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="invite-password-confirm"
                className="text-sm font-medium"
              >
                Confirmar contraseña
              </label>
              <Input
                id="invite-password-confirm"
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
