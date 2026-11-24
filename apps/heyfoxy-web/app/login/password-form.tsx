'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginPassword } from '@/app/actions';
import { buttonCls } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Formulario de acceso. `v2` solo cambia la presentación; la lógica de autenticación es la misma. */
export function PasswordForm({ v2 = false }: { v2?: boolean }) {
  const [state, action, pending] = useActionState(
    loginPassword,
    {} as { error?: string },
  );
  const field = v2
    ? 'border-border bg-card hover:border-control mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-[15px]'
    : 'bg-background mt-1 w-full rounded-md border px-3 py-2';
  return (
    <form
      action={action}
      className={cn('mt-6', v2 ? 'space-y-4' : 'space-y-3')}
    >
      <label className={cn('block text-sm', v2 && 'font-bold')}>
        Correo
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={field}
        />
      </label>
      <label className={cn('block text-sm', v2 && 'font-bold')}>
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className={field}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-critical-fg text-sm">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className={cn(
          buttonCls.primary,
          'w-full justify-center',
          v2 ? 'rounded-xl py-2.5 text-[15px] font-extrabold' : 'py-2',
        )}
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
