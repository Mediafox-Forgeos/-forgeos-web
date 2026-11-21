'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginPassword } from '@/app/actions';
import { buttonCls } from '@/components/ui';

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    loginPassword,
    {} as { error?: string },
  );
  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block text-sm">
        Correo
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="bg-background mt-1 w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="bg-background mt-1 w-full rounded-md border px-3 py-2"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-critical-fg text-sm">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className={buttonCls.primary + ' w-full justify-center py-2'}
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
      <p className="text-muted-foreground text-xs">
        El acceso es por invitación. No existe registro público.{' '}
        <Link
          href="/login/recuperar"
          className="text-primary-text hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  );
}
