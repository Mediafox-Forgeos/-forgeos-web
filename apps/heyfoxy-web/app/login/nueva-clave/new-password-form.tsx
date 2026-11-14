'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/app/actions';
import { buttonCls } from '@/components/ui';

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(
    updatePassword,
    {} as { error?: string },
  );
  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block text-sm">
        Nueva contraseña (mínimo 12 caracteres)
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="bg-background mt-1 w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Confirmar contraseña
        <input
          name="confirm"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="bg-background mt-1 w-full rounded-md border px-3 py-2"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className={buttonCls.primary + ' w-full justify-center py-2'}
      >
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
