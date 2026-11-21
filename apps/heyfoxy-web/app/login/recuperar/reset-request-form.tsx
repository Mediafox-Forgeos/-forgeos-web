'use client';

import { useActionState } from 'react';
import { requestPasswordReset } from '@/app/actions';
import { buttonCls } from '@/components/ui';

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    {} as { done?: boolean; error?: string },
  );
  if (state.done) {
    return (
      <p role="status" className="mt-4 rounded-md border p-3 text-sm">
        Si el correo pertenece a una cuenta activa, recibirás un enlace para
        crear una nueva contraseña. El enlace vence en una hora.
      </p>
    );
  }
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
      {state.error && (
        <p role="alert" className="text-critical-fg text-sm">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className={buttonCls.primary + ' w-full justify-center py-2'}
      >
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  );
}
